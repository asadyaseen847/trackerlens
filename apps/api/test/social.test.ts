import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { decryptToken, encryptToken } from '../src/social/crypto.js';
import { mockDay } from '../src/social/providers/mock.js';
import { signedInAgent, testApp } from './helpers.js';

const KEY = Buffer.alloc(32, 7).toString('base64');

describe('token encryption (§13)', () => {
  it('round-trips with AES-256-GCM and a random IV', () => {
    const a = encryptToken('secret-token', KEY);
    const b = encryptToken('secret-token', KEY);
    expect(a).not.toBe(b);
    expect(a).not.toContain('secret-token');
    expect(decryptToken(a, KEY)).toBe('secret-token');
  });

  it('rejects tampering and the wrong key', () => {
    const enc = encryptToken('secret-token', KEY);
    const parts = enc.split('.');
    const tampered = [...parts.slice(0, 3), Buffer.from('evil').toString('base64url')].join('.');
    expect(() => decryptToken(tampered, KEY)).toThrow();
    expect(() => decryptToken(enc, Buffer.alloc(32, 9).toString('base64'))).toThrow();
  });
});

describe('mock provider', () => {
  it('is deterministic', () => {
    expect(mockDay('instagram', '2026-05-01')).toEqual(mockDay('instagram', '2026-05-01'));
    expect(mockDay('instagram', '2026-05-01').views).toBeGreaterThan(0);
  });
});

async function connect(agent: request.Agent, platform: string) {
  const start = await agent.get(`/api/social/connect/${platform}`);
  expect(start.status).toBe(302);
  const callback = await agent.get(start.headers['location'] as string);
  expect(callback.status).toBe(302);
  return callback.headers['location'] as string;
}

describe('connecting a social account (mock)', () => {
  it('connects, stores encrypted tokens, backfills numbers, and shows them', async () => {
    const { app, db } = await testApp({ socialMock: true });
    const { agent } = await signedInAgent(app);

    expect(await connect(agent, 'instagram')).toBe('/app/social?connected=instagram');

    const accounts = (await agent.get('/api/social/accounts')).body;
    expect(accounts.sampleData).toBe(true);
    expect(accounts.accounts).toEqual([
      expect.objectContaining({ platform: 'instagram', handle: 'mybrand', status: 'connected' }),
    ]);

    const tokens = (
      await db.query<{ access_token_enc: string }>(
        'select access_token_enc from social_account_tokens',
      )
    ).rows[0]!;
    expect(tokens.access_token_enc.startsWith('v1.')).toBe(true);
    expect(tokens.access_token_enc).not.toContain('mock-instagram');

    const days = (await db.query<{ n: number }>('select count(*)::int n from social_daily_stats'))
      .rows[0]!.n;
    expect(days).toBeGreaterThan(500);

    const overview = (await agent.get('/api/social/overview?period=daily')).body;
    expect(overview.sampleData).toBe(true);
    expect(overview.platforms).toHaveLength(6);
    const ig = overview.platforms.find((p: { platform: string }) => p.platform === 'instagram');
    expect(ig.followers).toBeGreaterThan(0);
    expect(ig.views).toBeGreaterThan(0);
    expect(ig.engagementRate).toBeGreaterThan(0);
    expect(
      overview.platforms.find((p: { platform: string }) => p.platform === 'tiktok').account,
    ).toBeNull();
    expect(overview.totals.views.value).toBe(ig.views);
    expect(overview.series).toHaveLength(30);
    expect(overview.viewsToVisits).toHaveLength(1);
  });

  it('rejects a forged or mismatched state', async () => {
    const { app } = await testApp({ socialMock: true });
    const { agent } = await signedInAgent(app);
    const res = await agent.get('/api/social/callback/instagram?code=mock-instagram&state=forged');
    expect(res.headers['location']).toBe('/app/social?error=instagram');

    // A state started for Facebook can't connect Instagram.
    const start = await agent.get('/api/social/connect/facebook');
    const state = new URL(start.headers['location'] as string, 'http://x').searchParams.get(
      'state',
    );
    const swapped = await agent.get(
      `/api/social/callback/instagram?code=mock-instagram&state=${state}`,
    );
    expect(swapped.headers['location']).toBe('/app/social?error=instagram');
    expect((await agent.get('/api/social/accounts')).body.accounts).toEqual([]);
  });

  it('only lets the workspace disconnect its own accounts', async () => {
    const { app } = await testApp({ socialMock: true });
    const alice = await signedInAgent(app, 'Alice');
    const bob = await signedInAgent(app, 'Bob');
    await connect(alice.agent, 'youtube');
    const [account] = (await alice.agent.get('/api/social/accounts')).body.accounts;

    expect((await bob.agent.delete(`/api/social/accounts/${account.id}`)).status).toBe(404);
    expect((await bob.agent.get('/api/social/accounts')).body.accounts).toEqual([]);
    expect((await alice.agent.delete(`/api/social/accounts/${account.id}`)).status).toBe(204);
    expect((await alice.agent.get('/api/social/accounts')).body.accounts).toEqual([]);
  });

  it('rejects unknown platforms', async () => {
    const { app } = await testApp({ socialMock: true });
    const { agent } = await signedInAgent(app);
    expect((await agent.get('/api/social/connect/myspace')).status).toBe(404);
  });

  it('the daily sync cron is protected and up to date after connecting', async () => {
    const { app } = await testApp({ socialMock: true, cronSecret: 's3cret' });
    const { agent } = await signedInAgent(app);
    await connect(agent, 'linkedin');
    expect((await request(app).get('/api/cron/social-sync')).status).toBe(401);
    const res = await request(app)
      .get('/api/cron/social-sync')
      .set('Authorization', 'Bearer s3cret');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ ok: true, upToDate: 1, failed: 0 });
  });
});

describe('which platforms can be connected', () => {
  it('offers every platform with sample data, and none before real providers exist', async () => {
    const mock = await testApp({ socialMock: true });
    const { agent: a } = await signedInAgent(mock.app);
    expect((await a.get('/api/social/accounts')).body.available).toHaveLength(6);

    const real = await testApp({ socialMock: false });
    const { agent: b } = await signedInAgent(real.app);
    expect((await b.get('/api/social/accounts')).body).toMatchObject({
      sampleData: false,
      available: [],
    });
    expect((await b.get('/api/social/overview')).body.available).toEqual([]);
  });

  it('saves nothing when the tokens cannot be encrypted', async () => {
    const { app, db } = await testApp({ socialMock: true, encryptionKey: 'not-32-bytes' });
    const { agent } = await signedInAgent(app);
    const back = await connect(agent, 'linkedin');
    expect(back).toContain('error=linkedin');
    expect((await db.query('select 1 from social_accounts')).rows).toHaveLength(0);
  });
});
