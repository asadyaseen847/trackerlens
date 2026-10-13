import type { SocialPlatform } from '@audience/shared';
import type { AppDeps } from '../createApp.js';
import type { SocialAccountRow } from '../db/repo.js';
import { logger } from '../utils/logger.js';
import { decryptToken } from './crypto.js';
import { ProviderAuthError } from './provider.js';
import { getProvider } from './registry.js';

const DAY_MS = 86_400_000;
const utcDay = (ms: number) => new Date(ms).toISOString().slice(0, 10);

/** How far back the first sync goes: platforms keep limited history; the mock has 18 months. */
const BACKFILL_DAYS = { mock: 548, real: 90 };

export type SyncOutcome = 'synced' | 'up_to_date' | 'needs_reconnect' | 'failed';

/**
 * Fetches an account's daily numbers from the day after the last sync through yesterday (UTC)
 * and upserts social_daily_stats (§13). A refused token marks the account needs_reconnect.
 */
export async function syncAccount(
  deps: AppDeps,
  account: SocialAccountRow,
  now: Date = new Date(),
): Promise<SyncOutcome> {
  const yesterday = utcDay(now.getTime() - DAY_MS);
  const from = account.last_synced_at
    ? utcDay(Date.parse(account.last_synced_at))
    : utcDay(now.getTime() - (deps.socialMock ? BACKFILL_DAYS.mock : BACKFILL_DAYS.real) * DAY_MS);
  if (from > yesterday) return 'up_to_date';

  try {
    const stored = await deps.repo.getSocialTokens(account.id);
    if (!stored) throw new ProviderAuthError('No tokens stored');
    const provider = getProvider(account.platform_id as SocialPlatform, {
      useMock: deps.socialMock,
      appUrl: deps.appUrl,
    });
    const stats = await provider.fetchDailyStats(
      {
        accessToken: decryptToken(stored.access_token_enc, deps.encryptionKey),
        ...(stored.refresh_token_enc
          ? { refreshToken: decryptToken(stored.refresh_token_enc, deps.encryptionKey) }
          : {}),
      },
      from,
      yesterday,
    );
    await deps.repo.upsertSocialDailyStats(
      stats.map((s) => ({
        social_account_id: account.id,
        day: s.day,
        followers: s.followers ?? null,
        views: s.views ?? null,
        engagements: s.engagements ?? null,
        link_clicks: s.linkClicks ?? null,
      })),
    );
    await deps.repo.updateSocialAccount(account.id, {
      last_synced_at: now.toISOString(),
      status: 'connected',
    });
    return 'synced';
  } catch (err) {
    if (err instanceof ProviderAuthError) {
      await deps.repo.updateSocialAccount(account.id, { status: 'needs_reconnect' });
      return 'needs_reconnect';
    }
    logger.error('social sync failed', {
      account: account.id,
      platform: account.platform_id,
      error: err instanceof Error ? err.message : String(err),
    });
    return 'failed';
  }
}

/** Daily cron: sync every connected account (§13). */
export async function syncAllAccounts(
  deps: AppDeps,
  now: Date = new Date(),
): Promise<{ synced: number; upToDate: number; needsReconnect: number; failed: number }> {
  const result = { synced: 0, upToDate: 0, needsReconnect: 0, failed: 0 };
  for (const account of await deps.repo.listSocialAccountsToSync()) {
    const outcome = await syncAccount(deps, account, now);
    if (outcome === 'synced') result.synced += 1;
    else if (outcome === 'up_to_date') result.upToDate += 1;
    else if (outcome === 'needs_reconnect') result.needsReconnect += 1;
    else result.failed += 1;
  }
  return result;
}
