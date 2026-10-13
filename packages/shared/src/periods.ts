import type { DateRange, Period } from './types.js';

/**
 * Period and range math (BUILD_PROMPT §9), in the workspace timezone. Weeks start on Monday.
 *
 * Buckets are identified by their local start date ("YYYY-MM-DD"), which is exactly what
 * Postgres returns for to_char(date_trunc(unit, ts at time zone tz), 'YYYY-MM-DD').
 */

export type BucketUnit = 'day' | 'week' | 'month' | 'year';

export interface PeriodBucket {
  /** Local start date, YYYY-MM-DD. */
  key: string;
  /** ISO instant of the bucket's local start. */
  start: string;
  /** ISO instant of the next bucket's start (exclusive). */
  end: string;
  /** Short axis label: "Oct 6", "Oct ’26", "2025", "2026 so far". */
  label: string;
  /** Tooltip label: "Oct 6, 2026", "Week of Oct 5 – Oct 11, 2026", "October 2026". */
  fullLabel: string;
  /** The current, unfinished bucket (drawn striped). */
  partial: boolean;
}

export interface PeriodPlan {
  period: Period;
  unit: BucketUnit;
  /** Numbers (KPIs, breakdowns) cover this range: [start, now]. */
  range: DateRange;
  /** "vs before": the same number of whole days/weeks/months just before (Yearly: same dates last year). */
  compareRange: DateRange;
  /** The same ranges as local calendar days (YYYY-MM-DD, inclusive), for the daily rollup. */
  days: { from: string; to: string };
  compareDays: { from: string; to: string };
  /** The chart covers every bucket: [first bucket start, now]. */
  seriesRange: DateRange;
  buckets: PeriodBucket[];
  /** "Sep 15 – Oct 14, 2026" */
  rangeLabel: string;
  /** "Aug 16 – Sep 14" or "the same dates last year" */
  compareLabel: string;
}

export interface PeriodOptions {
  /** "Now", injectable for tests. */
  now: Date;
  /** IANA timezone of the workspace, e.g. "Asia/Karachi". */
  timezone: string;
  /** First data for the selection; the Yearly chart starts in its year. */
  firstDataAt?: Date | null;
}

/* ---------------------------------------------------------------------------------------
 * Calendar dates (timezone-free): { y, m (1-12), d }
 * ------------------------------------------------------------------------------------- */

interface Ymd {
  y: number;
  m: number;
  d: number;
}

const ymdToUtc = ({ y, m, d }: Ymd) => Date.UTC(y, m - 1, d);
const utcToYmd = (ms: number): Ymd => {
  const t = new Date(ms);
  return { y: t.getUTCFullYear(), m: t.getUTCMonth() + 1, d: t.getUTCDate() };
};
const addDays = (date: Ymd, days: number) => utcToYmd(ymdToUtc(date) + days * 86_400_000);
const addMonths = (date: Ymd, months: number): Ymd => {
  const total = date.y * 12 + (date.m - 1) + months;
  return { y: Math.floor(total / 12), m: (total % 12) + 1, d: date.d };
};
const pad = (n: number) => String(n).padStart(2, '0');
export const ymdKey = ({ y, m, d }: Ymd) => `${y}-${pad(m)}-${pad(d)}`;
/** Monday = 0 … Sunday = 6 */
const weekdayMon0 = (date: Ymd) => (new Date(ymdToUtc(date)).getUTCDay() + 6) % 7;

/* ---------------------------------------------------------------------------------------
 * Timezone conversion with Intl (handles daylight saving)
 * ------------------------------------------------------------------------------------- */

const formatters = new Map<string, Intl.DateTimeFormat>();
function formatterFor(timezone: string): Intl.DateTimeFormat {
  let f = formatters.get(timezone);
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      hourCycle: 'h23',
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
      second: 'numeric',
    });
    formatters.set(timezone, f);
  }
  return f;
}

/** Wall-clock parts of an instant in a timezone. */
function zonedParts(ms: number, timezone: string) {
  const parts: Record<string, number> = {};
  for (const p of formatterFor(timezone).formatToParts(new Date(ms))) {
    if (p.type !== 'literal') parts[p.type] = Number(p.value);
  }
  return {
    y: parts['year'] ?? 1970,
    m: parts['month'] ?? 1,
    d: parts['day'] ?? 1,
    h: parts['hour'] ?? 0,
    min: parts['minute'] ?? 0,
    s: parts['second'] ?? 0,
  };
}

/** Offset of the timezone from UTC at an instant, in ms (Karachi: +5h). */
function offsetAt(ms: number, timezone: string): number {
  const p = zonedParts(ms, timezone);
  return Date.UTC(p.y, p.m - 1, p.d, p.h, p.min, p.s) - Math.floor(ms / 1000) * 1000;
}

/** The instant a local calendar date starts (local midnight) in the timezone. */
export function startOfLocalDay(date: Ymd, timezone: string): number {
  const guess = ymdToUtc(date);
  let ms = guess - offsetAt(guess, timezone);
  // Second pass corrects for an offset change (daylight saving) between guess and result.
  ms = guess - offsetAt(ms, timezone);
  return ms;
}

/** The local calendar date of an instant. */
export function localDate(ms: number, timezone: string): Ymd {
  const p = zonedParts(ms, timezone);
  return { y: p.y, m: p.m, d: p.d };
}

/* ---------------------------------------------------------------------------------------
 * Labels
 * ------------------------------------------------------------------------------------- */

const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONTH = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];
const short = (date: Ymd, withYear = false) =>
  `${MON[date.m - 1]} ${date.d}${withYear ? `, ${date.y}` : ''}`;
const monthName = (date: Ymd) => `${MONTH[date.m - 1]} ${date.y}`;

/* ---------------------------------------------------------------------------------------
 * Periods
 * ------------------------------------------------------------------------------------- */

const UNIT: Record<Period, BucketUnit> = {
  daily: 'day',
  weekly: 'week',
  monthly: 'month',
  yearly: 'year',
};

/** Start dates of the buckets for a period, oldest first. */
function bucketStarts(period: Period, today: Ymd, firstDataYear: number): Ymd[] {
  switch (period) {
    case 'daily':
      return Array.from({ length: 30 }, (_, i) => addDays(today, i - 29));
    case 'weekly': {
      const monday = addDays(today, -weekdayMon0(today));
      return Array.from({ length: 12 }, (_, i) => addDays(monday, (i - 11) * 7));
    }
    case 'monthly': {
      const first = { ...today, d: 1 };
      return Array.from({ length: 12 }, (_, i) => addMonths(first, i - 11));
    }
    case 'yearly': {
      const from = Math.min(firstDataYear, today.y);
      return Array.from({ length: today.y - from + 1 }, (_, i) => ({ y: from + i, m: 1, d: 1 }));
    }
  }
}

function nextStart(period: Period, start: Ymd): Ymd {
  switch (period) {
    case 'daily':
      return addDays(start, 1);
    case 'weekly':
      return addDays(start, 7);
    case 'monthly':
      return addMonths(start, 1);
    case 'yearly':
      return { y: start.y + 1, m: 1, d: 1 };
  }
}

function labels(period: Period, start: Ymd, partial: boolean, today: Ymd) {
  switch (period) {
    case 'daily':
      return { label: short(start), fullLabel: short(start, true) };
    case 'weekly': {
      const end = addDays(start, 6);
      return { label: short(start), fullLabel: `Week of ${short(start)} – ${short(end, true)}` };
    }
    case 'monthly':
      return {
        label: `${MON[start.m - 1]} ’${String(start.y).slice(2)}`,
        fullLabel: monthName(start),
      };
    case 'yearly':
      return partial
        ? { label: `${start.y} so far`, fullLabel: `${start.y} so far (to ${short(today)})` }
        : { label: String(start.y), fullLabel: String(start.y) };
  }
}

const iso = (ms: number) => new Date(ms).toISOString();

/** Ranges, buckets and labels for a dashboard period (§9). */
export function getPeriodPlan(period: Period, options: PeriodOptions): PeriodPlan {
  const { timezone } = options;
  const nowMs = options.now.getTime();
  const today = localDate(nowMs, timezone);
  const firstYear = options.firstDataAt
    ? localDate(options.firstDataAt.getTime(), timezone).y
    : today.y;

  const starts = bucketStarts(period, today, firstYear);
  const buckets: PeriodBucket[] = starts.map((start) => {
    const startMs = startOfLocalDay(start, timezone);
    const endMs = startOfLocalDay(nextStart(period, start), timezone);
    const partial = nowMs < endMs;
    return {
      key: ymdKey(start),
      start: iso(startMs),
      end: iso(endMs),
      partial,
      ...labels(period, start, partial, today),
    };
  });

  const firstStart = starts[0] ?? today;
  const seriesStartMs = startOfLocalDay(firstStart, timezone);
  // End is exclusive; +1 ms includes a hit stamped exactly "now".
  const endMs = nowMs + 1;

  let range: DateRange;
  let compareRange: DateRange;
  let rangeLabel: string;
  let compareLabel: string;

  // Every range is whole local days, so the daily rollup can answer it exactly. The current
  // day is included up to now; "before" is the same number of whole days, weeks or months.
  let days: { from: string; to: string };
  let compareDays: { from: string; to: string };

  if (period === 'yearly') {
    // This year so far vs the same dates last year (Jan 1 to today's date, a year ago).
    const jan1 = { y: today.y, m: 1, d: 1 };
    const lastJan1 = { y: today.y - 1, m: 1, d: 1 };
    const sameDateLastYear = utcToYmd(ymdToUtc({ y: today.y - 1, m: today.m, d: today.d }));
    range = { start: iso(startOfLocalDay(jan1, timezone)), end: iso(endMs) };
    compareRange = {
      start: iso(startOfLocalDay(lastJan1, timezone)),
      end: iso(startOfLocalDay(addDays(sameDateLastYear, 1), timezone)),
    };
    days = { from: ymdKey(jan1), to: ymdKey(today) };
    compareDays = { from: ymdKey(lastJan1), to: ymdKey(sameDateLastYear) };
    rangeLabel = `Jan 1 – ${short(today, true)} (this year so far)`;
    compareLabel = 'the same dates last year';
  } else {
    const prevStart =
      period === 'daily'
        ? addDays(firstStart, -30)
        : period === 'weekly'
          ? addDays(firstStart, -84)
          : addMonths(firstStart, -12);
    const prevEnd = addDays(firstStart, -1);
    range = { start: iso(seriesStartMs), end: iso(endMs) };
    compareRange = { start: iso(startOfLocalDay(prevStart, timezone)), end: iso(seriesStartMs) };
    days = { from: ymdKey(firstStart), to: ymdKey(today) };
    compareDays = { from: ymdKey(prevStart), to: ymdKey(prevEnd) };
    if (period === 'monthly') {
      rangeLabel = `${monthName(firstStart)} – ${monthName(today)} (12 months)`;
      compareLabel = `${monthName(prevStart)} – ${monthName(prevEnd)}`;
    } else {
      rangeLabel =
        `${short(firstStart)} – ${short(today, true)}` + (period === 'weekly' ? ' (12 weeks)' : '');
      compareLabel = `${short(prevStart)} – ${short(prevEnd)}`;
    }
  }

  return {
    period,
    unit: UNIT[period],
    range,
    compareRange,
    seriesRange: { start: iso(seriesStartMs), end: iso(endMs) },
    days,
    compareDays,
    buckets,
    rangeLabel,
    compareLabel,
  };
}

/** Last N local days ending today, as bucket keys and the [start, now] range (site cards). */
export function lastDays(
  count: number,
  options: Pick<PeriodOptions, 'now' | 'timezone'>,
): { keys: string[]; range: DateRange } {
  const today = localDate(options.now.getTime(), options.timezone);
  const days = Array.from({ length: count }, (_, i) => addDays(today, i - count + 1));
  return {
    keys: days.map(ymdKey),
    range: {
      start: iso(startOfLocalDay(days[0] ?? today, options.timezone)),
      end: iso(options.now.getTime() + 1),
    },
  };
}

/** The bucket (local start date) a calendar day belongs to: the day, its Monday, month or year. */
export function bucketKeyOfDay(day: string, unit: BucketUnit): string {
  const [y, m, d] = day.split('-').map(Number) as [number, number, number];
  const date = { y, m, d };
  switch (unit) {
    case 'day':
      return day;
    case 'week':
      return ymdKey(addDays(date, -weekdayMon0(date)));
    case 'month':
      return ymdKey({ y, m, d: 1 });
    case 'year':
      return ymdKey({ y, m: 1, d: 1 });
  }
}

/** Percentage change, or null when there is nothing to compare with (§9). */
export function changePct(current: number, previous: number): number | null {
  if (previous <= 0) return null;
  return Math.round(((current - previous) / previous) * 1000) / 10;
}
