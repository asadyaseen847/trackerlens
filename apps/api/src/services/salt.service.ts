/**
 * Today's salt (UTC day), created lazily on first use.
 * TODO(Phase 2, §7.7): implement with an upsert so concurrent hits agree.
 */
export async function getDailySalt(_now: Date = new Date()): Promise<string> {
  return '';
}

/**
 * Delete salts older than 2 days. Returns the number deleted.
 * TODO(Phase 2, §7.7): implement (cron).
 */
export async function cleanupSalts(_now: Date = new Date()): Promise<number> {
  return 0;
}
