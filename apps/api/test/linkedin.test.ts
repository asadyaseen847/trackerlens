import { afterEach, describe, expect, it, vi } from 'vitest';
import { ProviderAuthError } from '../src/social/provider.js';
import { linkedinProvider } from '../src/social/providers/linkedin.js';
import { signedInAgent, testApp } from './helpers.js';

const LINKEDIN = {
  clientId: 'li-client',
  clientSecret: 'li-secret',
  apiVersion: '202609',
  scopes: ['r_organization_admin', 'rw_organization_admin'],
};
const CONFIG = { appUrl: 'https://app.example.com', linkedin: LINKEDIN };
const KEY = Buffer.alloc(32, 3).toString('base64');
const ORG = 'urn:li:organization:2414183';
const ms = (day: string) => Date.parse(`${day}T00:00:00Z`);
const DAY = 86_400_000;

interface Call {
  url: string;
  init: RequestInit | undefined;
}

/** A fake LinkedIn: answers each endpoint like the real API (shapes from LinkedIn's docs). */
function fakeLinkedIn(options: { followers?: number; admin?: boolean; status?: number } = {}) {
  const calls: Call[] = [];
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { 'Content-Type': 'application/json' },
    });
  const fetchImpl = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = String(input);
    calls.push({ url, init });
    if (options.status) return json({ message: 'nope' }, options.status);
    if (url.startsWith('https://www.linkedin.com/oauth/v2/accessToken')) {
      return json({
        access_token: 'access-1',
        expires_in: 5_184_000,
        refresh_token: 'refresh-1',
        scope: 'r_organization_admin,rw_organization_admin',
      });
    }
    const path = url.replace('https://api.linkedin.com/rest', '');
    if (path.startsWith('/organizationAcls')) {
      return json({
        elements:
          options.admin === false ? [] : [{ organizationTarget: ORG, role: 'ADMINISTRATOR' }],
      });
    }
    if (path.startsWith('/organizations/2414183')) {
      return json({ id: 2414183, localizedName: 'Acme Inc', vanityName: 'acme' });
    }
    if (path.startsWith('/networkSizes/'))
      return json({ firstDegreeSize: options.followers ?? 1000 });
    const range = /start:(\d+),end:(\d+)/.exec(decodeURIComponent(path));
    const start = Number(range?.[1]);
    const end = Number(range?.[2]);
    const days: number[] = [];
    for (let t = start; t < end; t += DAY) days.push(t);
    if (path.startsWith('/organizationalEntityFollowerStatistics')) {
      return json({
        elements: days.map((t) => ({
          timeRange: { start: t, end: t + DAY },
          followerGains: { organicFollowerGain: 2, paidFollowerGain: 1 },
          organizationalEntity: ORG,
        })),
      });
    }
    if (path.startsWith('/organizationalEntityShareStatistics')) {
      return json({
        elements: days.map((t) => ({
          timeRange: { start: t, end: t + DAY },
          totalShareStatistics: {
            impressionCount: 100,
            clickCount: 5,
            likeCount: 7,
            commentCount: 2,
            shareCount: 1,
          },
          organizationalEntity: ORG,
        })),
      });
    }
    return json({ message: `unexpected ${path}` }, 404);
  }) as typeof fetch;
  return { fetchImpl, calls };
}

describe('LinkedIn provider', () => {
  it('is available only when the app is configured', () => {
    expect(linkedinProvider({ appUrl: 'https://x.test' }).available).toBe(false);
    expect(linkedinProvider(CONFIG).available).toBe(true);
  });

  it('sends people to LinkedIn with our app, callback, state and scopes', () => {
    const url = new URL(linkedinProvider(CONFIG).getAuthUrl('state-123'));
    expect(url.origin + url.pathname).toBe('https://www.linkedin.com/oauth/v2/authorization');
    expect(Object.fromEntries(url.searchParams)).toEqual({
      response_type: 'code',
      client_id: 'li-client',
      redirect_uri: 'https://app.example.com/api/social/callback/linkedin',
      state: 'state-123',
      scope: 'r_organization_admin rw_organization_admin',
    });
  });

  it('swaps the code for tokens and finds the company page', async () => {
    const li = fakeLinkedIn();
    const provider = linkedinProvider(CONFIG, li.fetchImpl);
    const tokens = await provider.exchangeCode('the-code');
    expect(tokens).toMatchObject({ accessToken: 'access-1', refreshToken: 'refresh-1' });
    expect(tokens.expiresAt!.getTime()).toBeGreaterThan(Date.now() + 59 * DAY);
    const body = String(li.calls[0]!.init!.body);
    expect(body).toContain('grant_type=authorization_code');
    expect(body).toContain('client_secret=li-secret');

    expect(await provider.fetchProfile(tokens)).toEqual({
      externalId: '2414183',
      handle: 'acme',
      name: 'Acme Inc',
    });
    const headers = li.calls[1]!.init!.headers as Record<string, string>;
    expect(headers['LinkedIn-Version']).toBe('202609');
    expect(headers['X-Restli-Protocol-Version']).toBe('2.0.0');
    expect(headers['Authorization']).toBe('Bearer access-1');
  });

  it('explains when the person is not a page admin', async () => {
    const provider = linkedinProvider(CONFIG, fakeLinkedIn({ admin: false }).fetchImpl);
    await expect(provider.fetchProfile({ accessToken: 'a' })).rejects.toThrow(/not an admin/);
  });

  it('turns follower gains and share statistics into daily numbers', async () => {
    const provider = linkedinProvider(CONFIG, fakeLinkedIn({ followers: 1000 }).fetchImpl);
    const today = new Date().toISOString().slice(0, 10);
    const from = new Date(ms(today) - 3 * DAY).toISOString().slice(0, 10);
    const to = new Date(ms(today) - 1 * DAY).toISOString().slice(0, 10);
    const stats = await provider.fetchDailyStats({ accessToken: 'a' }, from, to, {
      externalId: '2414183',
    });
    expect(stats.map((s) => s.day)).toEqual([
      from,
      new Date(ms(today) - 2 * DAY).toISOString().slice(0, 10),
      to,
    ]);
    // Gains of 3 a day through today: yesterday ended at 1000 − 3 (today's gain), and so on.
    expect(stats.map((s) => s.followers)).toEqual([991, 994, 997]);
    expect(stats[0]).toMatchObject({ views: 100, linkClicks: 5, engagements: 7 + 2 + 1 + 5 });
  });

  it('reports a refused token so the account is marked for reconnecting', async () => {
    const provider = linkedinProvider(CONFIG, fakeLinkedIn({ status: 401 }).fetchImpl);
    await expect(provider.fetchProfile({ accessToken: 'old' })).rejects.toBeInstanceOf(
      ProviderAuthError,
    );
  });
});

describe('connecting LinkedIn through the API', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('connects a real page, stores encrypted tokens and its numbers', async () => {
    const li = fakeLinkedIn({ followers: 500 });
    vi.stubGlobal('fetch', li.fetchImpl);
    const { app, db } = await testApp({
      socialMock: false,
      encryptionKey: KEY,
      appUrl: 'https://app.example.com',
      linkedin: LINKEDIN,
    });
    const { agent } = await signedInAgent(app);

    const accounts = await agent.get('/api/social/accounts');
    expect(accounts.body.available).toEqual(['linkedin']);

    const start = await agent.get('/api/social/connect/linkedin');
    expect(start.status).toBe(302);
    const consent = new URL(start.headers['location'] as string);
    expect(consent.hostname).toBe('www.linkedin.com');

    // LinkedIn sends the browser back with a code and our state.
    const back = await agent.get(
      `/api/social/callback/linkedin?code=abc&state=${consent.searchParams.get('state')}`,
    );
    expect(back.headers['location']).toBe('/app/social?connected=linkedin');

    const account = (await db.query<Record<string, unknown>>('select * from social_accounts'))
      .rows[0];
    expect(account).toMatchObject({ external_id: '2414183', handle: 'acme', name: 'Acme Inc' });
    const tokens = (
      await db.query<{ access_token_enc: string }>('select * from social_account_tokens')
    ).rows[0]!;
    expect(tokens.access_token_enc).not.toContain('access-1');
    const days = (await db.query('select * from social_daily_stats')).rows;
    expect(days.length).toBeGreaterThan(80);

    const overview = await agent.get('/api/social/overview');
    const linkedin = overview.body.platforms.find(
      (p: { platform: string }) => p.platform === 'linkedin',
    );
    expect(linkedin.account.handle).toBe('acme');
    expect(linkedin.followers).toBeGreaterThan(0);
    expect(overview.body.sampleData).toBe(false);
  });

  it('shows the reason when the person is not a page admin', async () => {
    vi.stubGlobal('fetch', fakeLinkedIn({ admin: false }).fetchImpl);
    const { app, db } = await testApp({
      socialMock: false,
      encryptionKey: KEY,
      linkedin: LINKEDIN,
    });
    const { agent } = await signedInAgent(app);
    const start = await agent.get('/api/social/connect/linkedin');
    const state = new URL(start.headers['location'] as string).searchParams.get('state');
    const back = await agent.get(`/api/social/callback/linkedin?code=abc&state=${state}`);
    const location = new URL(back.headers['location'] as string, 'https://x.test');
    expect(location.searchParams.get('error')).toBe('linkedin');
    expect(location.searchParams.get('reason')).toMatch(/not an admin/);
    expect((await db.query('select 1 from social_accounts')).rows).toHaveLength(0);
  });

  it('keeps LinkedIn as "Coming soon" without app credentials', async () => {
    const { app } = await testApp({ socialMock: false, linkedin: undefined });
    const { agent } = await signedInAgent(app);
    expect((await agent.get('/api/social/accounts')).body.available).toEqual([]);
  });
});
