import { createHash } from 'node:crypto';

export interface VisitorHashInput {
  dailySalt: string;
  siteId: string;
  /** Used only in memory, never stored or logged. */
  ip: string;
  userAgent: string;
}

/**
 * sha256(dailySalt + siteId + ip + userAgent), first 16 hex characters (§7.7). The salt changes
 * every UTC day and is deleted after 2 days, so the hash can't be linked across days or
 * reversed to an IP address.
 */
export function visitorHash({ dailySalt, siteId, ip, userAgent }: VisitorHashInput): string {
  return createHash('sha256')
    .update(dailySalt + siteId + ip + userAgent)
    .digest('hex')
    .slice(0, 16);
}
