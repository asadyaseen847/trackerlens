import type { AppDeps } from '../createApp.js';

/**
 * Daily sync: for each connected account, fetch from the last synced day to yesterday and
 * upsert social_daily_stats. TODO(Phase 4, §13): implement.
 */
export async function syncAllAccounts(_deps: AppDeps): Promise<{ synced: number; failed: number }> {
  return { synced: 0, failed: 0 };
}
