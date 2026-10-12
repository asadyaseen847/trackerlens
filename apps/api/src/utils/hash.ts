export interface VisitorHashInput {
  dailySalt: string;
  siteId: string;
  /** Used only in memory, never stored or logged. */
  ip: string;
  userAgent: string;
}

/**
 * sha256(dailySalt + siteId + ip + userAgent), first 16 hex characters.
 * TODO(Phase 2, §7): implement and unit-test (same day → same hash; next day → different).
 */
export function visitorHash(_input: VisitorHashInput): string {
  return '0000000000000000';
}
