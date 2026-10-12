import type { DateRange, Period } from './types.js';

export interface PeriodOptions {
  /** "Now", injectable for tests. */
  now: Date;
  /** IANA timezone of the workspace, e.g. "Asia/Karachi". */
  timezone: string;
  /** First data for the selection; needed for the Yearly period. */
  firstDataAt?: Date;
}

export interface PeriodRanges {
  range: DateRange;
  compareRange: DateRange;
  /** Bucket unit for $dateTrunc. */
  unit: 'day' | 'week' | 'month' | 'year';
  bucketCount: number;
}

const UNITS = { daily: 'day', weekly: 'week', monthly: 'month', yearly: 'year' } as const;

/**
 * Range, comparison range and bucket unit for a period, in the workspace timezone.
 * Weeks start on Monday.
 * TODO(Phase 3, §9): implement and unit-test (daylight saving, year boundary).
 */
export function getPeriodRanges(period: Period, options: PeriodOptions): PeriodRanges {
  const now = options.now.toISOString();
  return {
    range: { start: now, end: now },
    compareRange: { start: now, end: now },
    unit: UNITS[period],
    bucketCount: 0,
  };
}
