import { HttpError } from '../../utils/httpError.js';
import {
  callbackUrl,
  ProviderAuthError,
  type DailyStat,
  type ProviderConfig,
  type SocialProvider,
  type TokenSet,
} from '../provider.js';

/**
 * LinkedIn company pages (§13, docs/social-providers.md), via LinkedIn's Community Management
 * API (versioned REST API). The person connecting must be an ADMINISTRATOR of the page.
 *
 * - Followers: today's total (networkSizes) minus the daily gains after each day.
 * - Views: impressions of the page's posts (organizationalEntityShareStatistics, organic only).
 * - Engagements: likes + comments + shares + clicks. Link clicks: clicks.
 *
 * LinkedIn keeps 12 months of daily statistics; follower gains arrive about 2 days late, so the
 * sync re-reads the last few days every time (see social/sync.ts).
 */

const AUTH_URL = 'https://www.linkedin.com/oauth/v2/authorization';
const TOKEN_URL = 'https://www.linkedin.com/oauth/v2/accessToken';
const API = 'https://api.linkedin.com/rest';
const DAY_MS = 86_400_000;

type Fetch = typeof fetch;

const dayStartMs = (day: string) => Date.parse(`${day}T00:00:00Z`);
const utcDay = (ms: number) => new Date(ms).toISOString().slice(0, 10);

interface TokenResponse {
  access_token: string;
  expires_in: number;
  refresh_token?: string;
  scope?: string;
}

interface TimeBound<T> {
  timeRange: { start: number; end: number };
  followerGains?: T;
  totalShareStatistics?: T;
}

export function linkedinProvider(config: ProviderConfig, fetchImpl: Fetch = fetch): SocialProvider {
  const app = config.linkedin;

  async function tokenRequest(params: Record<string, string>): Promise<TokenSet> {
    if (!app) throw new HttpError(503, 'LinkedIn is not set up on this server.');
    const res = await fetchImpl(TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        ...params,
        client_id: app.clientId,
        client_secret: app.clientSecret,
      }),
    });
    if (!res.ok) {
      // 400/401 here means the code or refresh token is no good: the user must connect again.
      throw new ProviderAuthError(`LinkedIn token request failed (${res.status})`);
    }
    const body = (await res.json()) as TokenResponse;
    return {
      accessToken: body.access_token,
      ...(body.refresh_token ? { refreshToken: body.refresh_token } : {}),
      expiresAt: new Date(Date.now() + body.expires_in * 1000),
      scopes: body.scope ? body.scope.split(/[ ,]+/).filter(Boolean) : [],
    };
  }

  async function get<T>(tokens: TokenSet, path: string): Promise<T> {
    const res = await fetchImpl(`${API}${path}`, {
      headers: {
        Authorization: `Bearer ${tokens.accessToken}`,
        'LinkedIn-Version': app?.apiVersion ?? '',
        'X-Restli-Protocol-Version': '2.0.0',
      },
    });
    if (res.status === 401) throw new ProviderAuthError('LinkedIn refused the access token');
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(
        `LinkedIn ${path.split('?')[0]} failed (${res.status}): ${text.slice(0, 300)}`,
      );
    }
    return (await res.json()) as T;
  }

  /** Daily rows of a time-bound statistics finder, keyed by UTC day. */
  async function daily<T>(
    tokens: TokenSet,
    finder: string,
    urn: string,
    startMs: number,
    endMs: number,
  ): Promise<Map<string, T>> {
    const body = await get<{ elements?: Array<TimeBound<T>> }>(
      tokens,
      `/${finder}?q=organizationalEntity&organizationalEntity=${encodeURIComponent(urn)}` +
        `&timeIntervals=(timeRange:(start:${startMs},end:${endMs}),timeGranularityType:DAY)`,
    );
    const out = new Map<string, T>();
    for (const el of body.elements ?? []) {
      const value = el.followerGains ?? el.totalShareStatistics;
      if (value) out.set(utcDay(el.timeRange.start), value);
    }
    return out;
  }

  return {
    id: 'linkedin',
    available: app !== undefined,

    getAuthUrl(state) {
      if (!app) throw new HttpError(503, 'LinkedIn is not set up on this server.');
      const params = new URLSearchParams({
        response_type: 'code',
        client_id: app.clientId,
        redirect_uri: callbackUrl(config, 'linkedin'),
        state,
        scope: app.scopes.join(' '),
      });
      return `${AUTH_URL}?${params.toString()}`;
    },

    exchangeCode(code) {
      return tokenRequest({
        grant_type: 'authorization_code',
        code,
        redirect_uri: callbackUrl(config, 'linkedin'),
      });
    },

    async refresh(tokens) {
      if (!tokens.refreshToken) throw new ProviderAuthError('No LinkedIn refresh token');
      return tokenRequest({ grant_type: 'refresh_token', refresh_token: tokens.refreshToken });
    },

    async fetchProfile(tokens) {
      // The first company page this person administers.
      const acls = await get<{
        elements?: Array<{ organization?: string; organizationTarget?: string }>;
      }>(tokens, '/organizationAcls?q=roleAssignee&role=ADMINISTRATOR&state=APPROVED');
      const urn = acls.elements?.map((e) => e.organization ?? e.organizationTarget).find(Boolean);
      if (!urn) {
        throw new HttpError(
          400,
          'This LinkedIn account is not an admin of any company page. Ask a page admin to connect.',
        );
      }
      const id = urn.split(':').pop() ?? urn;
      const org = await get<{ localizedName?: string; vanityName?: string }>(
        tokens,
        `/organizations/${id}`,
      );
      return {
        externalId: id,
        handle: org.vanityName ?? id,
        name: org.localizedName ?? org.vanityName ?? `LinkedIn page ${id}`,
      };
    },

    async fetchDailyStats(tokens, fromDay, toDay, account) {
      const urn = `urn:li:organization:${account.externalId}`;
      const startMs = dayStartMs(fromDay);
      const endMs = dayStartMs(toDay) + DAY_MS;
      // Follower gains run to today, so each day's total can be worked back from today's.
      const todayEndMs = dayStartMs(utcDay(Date.now())) + DAY_MS;

      const [network, gains, shares] = await Promise.all([
        get<{ firstDegreeSize?: number }>(
          tokens,
          `/networkSizes/${encodeURIComponent(urn)}?edgeType=COMPANY_FOLLOWED_BY_MEMBER`,
        ),
        daily<{ organicFollowerGain?: number; paidFollowerGain?: number }>(
          tokens,
          'organizationalEntityFollowerStatistics',
          urn,
          startMs,
          Math.max(endMs, todayEndMs),
        ),
        daily<{
          impressionCount?: number;
          clickCount?: number;
          likeCount?: number;
          commentCount?: number;
          shareCount?: number;
        }>(tokens, 'organizationalEntityShareStatistics', urn, startMs, endMs),
      ]);

      const gainOn = (day: string) => {
        const g = gains.get(day);
        return (g?.organicFollowerGain ?? 0) + (g?.paidFollowerGain ?? 0);
      };
      // Followers at the end of `day` = today's total − gains on every later day we know of.
      const later = [...gains.keys()].sort();
      const totalNow = network.firstDegreeSize;

      const out: DailyStat[] = [];
      for (let ms = startMs; ms < endMs; ms += DAY_MS) {
        const day = utcDay(ms);
        const stat: DailyStat = { day };
        if (totalNow !== undefined) {
          const after = later.filter((d) => d > day).reduce((sum, d) => sum + gainOn(d), 0);
          stat.followers = Math.max(0, totalNow - after);
        }
        const s = shares.get(day);
        stat.views = s?.impressionCount ?? 0;
        stat.linkClicks = s?.clickCount ?? 0;
        stat.engagements =
          Math.max(0, s?.likeCount ?? 0) +
          (s?.commentCount ?? 0) +
          (s?.shareCount ?? 0) +
          (s?.clickCount ?? 0);
        out.push(stat);
      }
      return out;
    },
  };
}
