/**
 * Daily sync: for each connected account, fetch from the last synced day to yesterday and
 * upsert SocialDailyStat. Mark accounts needs_reconnect when the platform refuses the token.
 * TODO(Phase 4, §13): implement.
 */
export async function syncAllAccounts(): Promise<{ synced: number; failed: number }> {
  return { synced: 0, failed: 0 };
}
