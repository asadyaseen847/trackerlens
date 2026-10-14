import {
  bucketKeyOfDay,
  changePct,
  getPeriodPlan,
  SOCIAL_PLATFORMS,
  socialQuerySchema,
  type Kpi,
  type SocialAccountDto,
  type SocialOverviewResponse,
  type SocialPlatform,
  type SocialPlatformSummary,
} from '@audience/shared';
import jwt from 'jsonwebtoken';
import type { AppDeps } from '../createApp.js';
import type { SocialAccountRow, SocialDailyStatRow } from '../db/repo.js';
import type { AuthContext } from '../middleware/requireAuth.js';
import { encryptToken } from '../social/crypto.js';
import { availablePlatforms, getProvider } from '../social/registry.js';
import { syncAccount } from '../social/sync.js';
import { HttpError } from '../utils/httpError.js';
import { jwtSecret } from './auth.service.js';

const PLATFORM_IDS = new Set<string>(SOCIAL_PLATFORMS.map((p) => p.id));

export function parsePlatform(value: string): SocialPlatform {
  if (!PLATFORM_IDS.has(value)) throw new HttpError(404, 'Unknown platform.');
  return value as SocialPlatform;
}

export function toSocialAccountDto(row: SocialAccountRow): SocialAccountDto {
  return {
    id: row.id,
    platform: row.platform_id as SocialPlatform,
    handle: row.handle,
    name: row.name,
    ...(row.avatar_url ? { avatarUrl: row.avatar_url } : {}),
    status: row.status,
    lastSyncedAt: row.last_synced_at,
  };
}

/* ---------- OAuth state: ties the callback to the user who started it ---------- */

interface StatePayload {
  workspaceId: string;
  userId: string;
  platform: SocialPlatform;
}

function signState(payload: StatePayload): string {
  return jwt.sign(payload, jwtSecret(), {
    expiresIn: 600,
    audience: 'social-oauth',
    algorithm: 'HS256',
  });
}

function verifyState(token: string, expected: StatePayload): void {
  try {
    const payload = jwt.verify(token, jwtSecret(), {
      audience: 'social-oauth',
      algorithms: ['HS256'],
    }) as Partial<StatePayload>;
    if (
      payload.workspaceId !== expected.workspaceId ||
      payload.userId !== expected.userId ||
      payload.platform !== expected.platform
    ) {
      throw new Error('mismatch');
    }
  } catch {
    throw new HttpError(400, 'This connection link expired or was not started by you. Try again.');
  }
}

/** Where to send the browser to connect a platform (its OAuth screen, or straight back for the mock). */
export function connectUrl(deps: AppDeps, auth: AuthContext, platform: SocialPlatform): string {
  const state = signState({ workspaceId: auth.workspaceId, userId: auth.userId, platform });
  return getProvider(platform, { useMock: deps.socialMock, appUrl: deps.appUrl }).getAuthUrl(state);
}

/**
 * OAuth callback: check the state, swap the code for tokens, read the profile, store the account
 * with encrypted tokens, and run the first sync so the page has numbers right away (§13).
 */
export async function completeConnection(
  deps: AppDeps,
  auth: AuthContext,
  platform: SocialPlatform,
  code: string,
  state: string,
): Promise<SocialAccountRow> {
  verifyState(state, { workspaceId: auth.workspaceId, userId: auth.userId, platform });
  const provider = getProvider(platform, { useMock: deps.socialMock, appUrl: deps.appUrl });
  const tokens = await provider.exchangeCode(code);
  const profile = await provider.fetchProfile(tokens);
  // Encrypt first: a missing or bad ENCRYPTION_KEY fails here, before anything is saved.
  const accessTokenEnc = encryptToken(tokens.accessToken, deps.encryptionKey);
  const refreshTokenEnc = tokens.refreshToken
    ? encryptToken(tokens.refreshToken, deps.encryptionKey)
    : null;

  const account = await deps.repo.upsertSocialAccount({
    workspace_id: auth.workspaceId,
    platform_id: platform,
    external_id: profile.externalId,
    handle: profile.handle,
    name: profile.name,
    avatar_url: profile.avatarUrl ?? null,
    status: 'connected',
  });
  try {
    await deps.repo.saveSocialTokens({
      social_account_id: account.id,
      access_token_enc: accessTokenEnc,
      refresh_token_enc: refreshTokenEnc,
      expires_at: tokens.expiresAt?.toISOString() ?? null,
      scopes: tokens.scopes ?? [],
    });
  } catch (err) {
    // Never leave an account that says "Connected" without a token behind it.
    await deps.repo.updateSocialAccount(account.id, { status: 'needs_reconnect' });
    throw err;
  }
  await syncAccount(deps, account);
  return account;
}

/* ---------- Overview (§11, §13) ---------- */

function kpi(value: number, previous: number): Kpi {
  return { value, previous, changePct: changePct(value, previous) };
}

/** Latest reported followers on or before a day (stats sorted by day). */
function followersOn(stats: SocialDailyStatRow[], day: string): number | null {
  let value: number | null = null;
  for (const s of stats) {
    if (s.day > day) break;
    if (s.followers !== null) value = s.followers;
  }
  return value;
}

function sumIn(
  stats: SocialDailyStatRow[],
  from: string,
  to: string,
  field: 'views' | 'engagements',
) {
  return stats.reduce((sum, s) => (s.day >= from && s.day <= to ? sum + (s[field] ?? 0) : sum), 0);
}

const dayBefore = (day: string) =>
  new Date(Date.parse(`${day}T00:00:00Z`) - 86_400_000).toISOString().slice(0, 10);

/** GET /social/overview?period= — totals, per-platform cards, chart and the views → visits table. */
export async function getSocialOverview(
  deps: AppDeps,
  workspaceId: string,
  query: unknown,
  now = new Date(),
): Promise<SocialOverviewResponse> {
  const { period } = socialQuerySchema.parse(query);
  const [workspace, accounts, sites] = await Promise.all([
    deps.repo.findWorkspaceById(workspaceId),
    deps.repo.listSocialAccounts(workspaceId),
    deps.repo.listSites(workspaceId),
  ]);
  const timezone = workspace?.timezone ?? 'UTC';
  const connected = accounts.filter((a) => a.status !== 'disconnected');
  const allStats = await deps.repo.listSocialDailyStats(
    connected.map((a) => a.id),
    '1970-01-01',
    '9999-12-31',
  );
  const firstDay = allStats[0]?.day;
  const plan = getPeriodPlan(period, {
    now,
    timezone,
    firstDataAt: firstDay ? new Date(`${firstDay}T12:00:00Z`) : null,
  });
  const cur = plan.days;
  const prev = plan.compareDays;

  // Website visits per platform (the "Visits to your websites" numbers).
  const siteIds = sites.map((s) => s.id);
  const visitFilters = { siteIds, channels: null, device: null, country: null };
  const [visitsNow, visitsBefore] = await Promise.all([
    deps.repo.statsBreakdown(
      { ...visitFilters, fromDay: plan.days.from, toDay: plan.days.to },
      'platform',
      250,
    ),
    deps.repo.statsBreakdown(
      { ...visitFilters, fromDay: plan.compareDays.from, toDay: plan.compareDays.to },
      'platform',
      250,
    ),
  ]);
  const visitsOf = (rows: typeof visitsNow, platform: string) =>
    rows.find((r) => r.key === platform)?.value ?? 0;

  const byAccount = new Map<string, SocialDailyStatRow[]>();
  for (const s of allStats) {
    const list = byAccount.get(s.social_account_id) ?? [];
    list.push(s);
    byAccount.set(s.social_account_id, list);
  }

  const totals = { followers: [0, 0], newFollowers: [0, 0], views: [0, 0], visits: [0, 0] };
  const platforms: SocialPlatformSummary[] = SOCIAL_PLATFORMS.map(({ id }) => {
    const account = connected.find((a) => a.platform_id === id);
    if (!account) {
      return {
        platform: id,
        account: null,
        followers: null,
        newFollowers: 0,
        views: 0,
        engagementRate: null,
        visits: 0,
        visitsPer1000Views: null,
      };
    }
    const stats = byAccount.get(account.id) ?? [];
    const followersEnd = followersOn(stats, cur.to);
    const followersStart = followersOn(stats, dayBefore(cur.from));
    const followersPrevEnd = followersOn(stats, prev.to);
    const followersPrevStart = followersOn(stats, dayBefore(prev.from));
    const views = sumIn(stats, cur.from, cur.to, 'views');
    const engagements = sumIn(stats, cur.from, cur.to, 'engagements');
    const visits = visitsOf(visitsNow, id);
    const gained =
      followersEnd !== null && followersStart !== null ? followersEnd - followersStart : 0;

    totals.followers[0]! += followersEnd ?? 0;
    totals.followers[1]! += followersPrevEnd ?? 0;
    totals.newFollowers[0]! += gained;
    totals.newFollowers[1]! +=
      followersPrevEnd !== null && followersPrevStart !== null
        ? followersPrevEnd - followersPrevStart
        : 0;
    totals.views[0]! += views;
    totals.views[1]! += sumIn(stats, prev.from, prev.to, 'views');
    totals.visits[0]! += visits;
    totals.visits[1]! += visitsOf(visitsBefore, id);

    return {
      platform: id,
      account: toSocialAccountDto(account),
      followers: followersEnd,
      newFollowers: gained,
      views,
      engagementRate: views > 0 ? Math.round((engagements / views) * 1000) / 10 : null,
      visits,
      visitsPer1000Views: views > 0 ? Math.round((visits / views) * 10_000) / 10 : null,
    };
  });

  // Post views per bucket and connected platform.
  const series = plan.buckets.map((b) => ({
    start: b.start,
    label: b.label,
    fullLabel: b.fullLabel,
    partial: b.partial,
    byPlatform: {} as Partial<Record<SocialPlatform, number>>,
  }));
  const bucketIndex = new Map(plan.buckets.map((b, i) => [b.key, i]));
  const seriesFrom = plan.buckets[0]?.key ?? cur.from;
  for (const account of connected) {
    const id = account.platform_id as SocialPlatform;
    for (const s of byAccount.get(account.id) ?? []) {
      if (s.day < seriesFrom || s.day > cur.to) continue;
      const i = bucketIndex.get(bucketKeyOfDay(s.day, plan.unit));
      if (i === undefined) continue;
      const bucket = series[i]!.byPlatform;
      bucket[id] = (bucket[id] ?? 0) + (s.views ?? 0);
    }
  }

  return {
    rangeLabel: plan.rangeLabel,
    compareLabel: plan.compareLabel,
    unit: plan.unit,
    sampleData: deps.socialMock,
    available: availablePlatforms({ useMock: deps.socialMock, appUrl: deps.appUrl }),
    totals: {
      followers: kpi(totals.followers[0]!, totals.followers[1]!),
      newFollowers: kpi(totals.newFollowers[0]!, totals.newFollowers[1]!),
      views: kpi(totals.views[0]!, totals.views[1]!),
      visits: kpi(totals.visits[0]!, totals.visits[1]!),
    },
    platforms,
    series,
    viewsToVisits: platforms
      .filter((p) => p.account)
      .map((p) => ({
        platform: p.platform,
        views: p.views,
        visits: p.visits,
        visitsPer1000Views: p.visitsPer1000Views ?? 0,
        newFollowers: p.newFollowers,
      }))
      .sort((a, b) => b.visitsPer1000Views - a.visitsPer1000Views),
  };
}
