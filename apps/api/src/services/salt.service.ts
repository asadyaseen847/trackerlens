import { randomBytes } from 'node:crypto';
import type { Repo } from '../db/repo.js';

/** 'YYYY-MM-DD' of a UTC day. */
export function utcDay(at: Date): string {
  return at.toISOString().slice(0, 10);
}

// Warm function instances reuse today's salt instead of asking the database every hit.
const cache = new Map<string, string>();

/** Today's salt (UTC day). Created on first use; concurrent creators agree on one value. */
export async function getDailySalt(repo: Repo, now: Date = new Date()): Promise<string> {
  const day = utcDay(now);
  const cached = cache.get(day);
  if (cached) return cached;
  const salt = await repo.getOrCreateSalt(day, randomBytes(32).toString('hex'));
  cache.clear();
  cache.set(day, salt);
  return salt;
}

/**
 * Delete salts older than 2 days: today's and yesterday's stay, for hits around midnight.
 * Returns how many were deleted (§7.7, cron).
 */
export async function cleanupSalts(repo: Repo, now: Date = new Date()): Promise<number> {
  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  return repo.cleanupSalts(utcDay(yesterday));
}

/** For tests: forget cached salts. */
export function clearSaltCache(): void {
  cache.clear();
}
