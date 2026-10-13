import { describe, expect, it } from 'vitest';
import { changePct, getPeriodPlan, lastDays, localDate, startOfLocalDay } from '../src/periods.js';

const KARACHI = 'Asia/Karachi'; // UTC+5, no daylight saving
const NEW_YORK = 'America/New_York'; // DST: Mar 8 2026, Nov 1 2026
const LONDON = 'Europe/London'; // DST: Mar 29 2026, Oct 25 2026

// Wednesday, Oct 14 2026, 15:30 in Karachi.
const NOW = new Date('2026-10-14T10:30:00Z');

describe('timezone helpers', () => {
  it('finds local midnight', () => {
    expect(new Date(startOfLocalDay({ y: 2026, m: 10, d: 14 }, KARACHI)).toISOString()).toBe(
      '2026-10-13T19:00:00.000Z',
    );
    expect(new Date(startOfLocalDay({ y: 2026, m: 10, d: 14 }, 'UTC')).toISOString()).toBe(
      '2026-10-14T00:00:00.000Z',
    );
  });

  it('handles daylight saving in New York', () => {
    // Before the spring change (EST, -5) and after it (EDT, -4).
    expect(new Date(startOfLocalDay({ y: 2026, m: 3, d: 8 }, NEW_YORK)).toISOString()).toBe(
      '2026-03-08T05:00:00.000Z',
    );
    expect(new Date(startOfLocalDay({ y: 2026, m: 3, d: 9 }, NEW_YORK)).toISOString()).toBe(
      '2026-03-09T04:00:00.000Z',
    );
    // Autumn: Nov 1 starts in EDT, Nov 2 in EST.
    expect(new Date(startOfLocalDay({ y: 2026, m: 11, d: 1 }, NEW_YORK)).toISOString()).toBe(
      '2026-11-01T04:00:00.000Z',
    );
    expect(new Date(startOfLocalDay({ y: 2026, m: 11, d: 2 }, NEW_YORK)).toISOString()).toBe(
      '2026-11-02T05:00:00.000Z',
    );
  });

  it('knows the local date of an instant', () => {
    expect(localDate(Date.parse('2026-10-13T20:00:00Z'), KARACHI)).toEqual({
      y: 2026,
      m: 10,
      d: 14,
    });
    expect(localDate(Date.parse('2026-10-13T20:00:00Z'), NEW_YORK)).toEqual({
      y: 2026,
      m: 10,
      d: 13,
    });
  });
});

describe('getPeriodPlan: daily', () => {
  const plan = getPeriodPlan('daily', { now: NOW, timezone: KARACHI });

  it('has 30 days ending today, today partial', () => {
    expect(plan.unit).toBe('day');
    expect(plan.buckets).toHaveLength(30);
    expect(plan.buckets[0]?.key).toBe('2026-09-15');
    expect(plan.buckets[29]).toMatchObject({ key: '2026-10-14', partial: true, label: 'Oct 14' });
    expect(plan.buckets[28]?.partial).toBe(false);
    expect(plan.buckets[29]?.fullLabel).toBe('Oct 14, 2026');
  });

  it('ranges from the first bucket to now, compared with the previous 30 whole days', () => {
    expect(plan.range.start).toBe('2026-09-14T19:00:00.000Z');
    expect(plan.range.end).toBe('2026-10-14T10:30:00.001Z');
    expect(plan.compareRange).toEqual({
      start: '2026-08-15T19:00:00.000Z',
      end: '2026-09-14T19:00:00.000Z',
    });
    expect(plan.days).toEqual({ from: '2026-09-15', to: '2026-10-14' });
    expect(plan.compareDays).toEqual({ from: '2026-08-16', to: '2026-09-14' });
    expect(plan.rangeLabel).toBe('Sep 15 – Oct 14, 2026');
    expect(plan.compareLabel).toBe('Aug 16 – Sep 14');
  });

  it('weekly and monthly compare the previous 12 whole weeks / months', () => {
    const weekly = getPeriodPlan('weekly', { now: NOW, timezone: KARACHI });
    expect(weekly.days).toEqual({ from: '2026-07-27', to: '2026-10-14' });
    expect(weekly.compareDays).toEqual({ from: '2026-05-04', to: '2026-07-26' });
    const monthly = getPeriodPlan('monthly', { now: NOW, timezone: KARACHI });
    expect(monthly.days).toEqual({ from: '2025-11-01', to: '2026-10-14' });
    expect(monthly.compareDays).toEqual({ from: '2024-11-01', to: '2025-10-31' });
    expect(monthly.compareLabel).toBe('November 2024 – October 2025');
  });

  it('yearly compares Jan 1 to today with the same dates last year', () => {
    const yearly = getPeriodPlan('yearly', { now: NOW, timezone: KARACHI });
    expect(yearly.days).toEqual({ from: '2026-01-01', to: '2026-10-14' });
    expect(yearly.compareDays).toEqual({ from: '2025-01-01', to: '2025-10-14' });
  });

  it('bucket boundaries chain without gaps', () => {
    for (let i = 1; i < plan.buckets.length; i++) {
      expect(plan.buckets[i]?.start).toBe(plan.buckets[i - 1]?.end);
    }
  });

  it('has 23- and 25-hour days across daylight saving (London, Oct 25)', () => {
    const london = getPeriodPlan('daily', {
      now: new Date('2026-10-27T12:00:00Z'),
      timezone: LONDON,
    });
    const day = london.buckets.find((b) => b.key === '2026-10-25');
    expect(Date.parse(day!.end) - Date.parse(day!.start)).toBe(25 * 3600_000);
    const spring = getPeriodPlan('daily', {
      now: new Date('2026-04-02T12:00:00Z'),
      timezone: LONDON,
    });
    const short = spring.buckets.find((b) => b.key === '2026-03-29');
    expect(Date.parse(short!.end) - Date.parse(short!.start)).toBe(23 * 3600_000);
  });
});

describe('getPeriodPlan: weekly', () => {
  const plan = getPeriodPlan('weekly', { now: NOW, timezone: KARACHI });

  it('has 12 weeks starting on Monday, the current one partial', () => {
    expect(plan.buckets).toHaveLength(12);
    expect(plan.buckets[11]).toMatchObject({ key: '2026-10-12', partial: true }); // Monday
    expect(plan.buckets[0]?.key).toBe('2026-07-27');
    for (const b of plan.buckets) expect(new Date(`${b.key}T00:00:00Z`).getUTCDay()).toBe(1);
    expect(plan.buckets[11]?.fullLabel).toBe('Week of Oct 12 – Oct 18, 2026');
    expect(plan.rangeLabel).toBe('Jul 27 – Oct 14, 2026 (12 weeks)');
  });

  it('a Monday is the first day of its own week', () => {
    const monday = getPeriodPlan('weekly', {
      now: new Date('2026-10-12T00:30:00Z'),
      timezone: KARACHI,
    });
    expect(monday.buckets[11]?.key).toBe('2026-10-12');
  });

  it('a Sunday belongs to the week that started six days before', () => {
    const sunday = getPeriodPlan('weekly', {
      now: new Date('2026-10-18T12:00:00Z'),
      timezone: KARACHI,
    });
    expect(sunday.buckets[11]?.key).toBe('2026-10-12');
  });
});

describe('getPeriodPlan: monthly', () => {
  it('has 12 months including the current one', () => {
    const plan = getPeriodPlan('monthly', { now: NOW, timezone: KARACHI });
    expect(plan.buckets.map((b) => b.key)).toEqual([
      '2025-11-01',
      '2025-12-01',
      '2026-01-01',
      '2026-02-01',
      '2026-03-01',
      '2026-04-01',
      '2026-05-01',
      '2026-06-01',
      '2026-07-01',
      '2026-08-01',
      '2026-09-01',
      '2026-10-01',
    ]);
    expect(plan.buckets[11]).toMatchObject({
      partial: true,
      label: 'Oct ’26',
      fullLabel: 'October 2026',
    });
    expect(plan.rangeLabel).toBe('November 2025 – October 2026 (12 months)');
  });

  it('crosses the year boundary in January', () => {
    const jan = getPeriodPlan('monthly', {
      now: new Date('2027-01-05T12:00:00Z'),
      timezone: KARACHI,
    });
    expect(jan.buckets[0]?.key).toBe('2026-02-01');
    expect(jan.buckets[11]?.key).toBe('2027-01-01');
  });
});

describe('getPeriodPlan: yearly', () => {
  it('has one bucket per year since the first data, this year partial', () => {
    const plan = getPeriodPlan('yearly', {
      now: NOW,
      timezone: KARACHI,
      firstDataAt: new Date('2025-03-02T00:00:00Z'),
    });
    expect(plan.buckets.map((b) => b.label)).toEqual(['2025', '2026 so far']);
    expect(plan.buckets[1]).toMatchObject({ partial: true, fullLabel: '2026 so far (to Oct 14)' });
  });

  it('compares this year so far with the same dates last year', () => {
    const plan = getPeriodPlan('yearly', { now: NOW, timezone: KARACHI });
    expect(plan.range.start).toBe('2025-12-31T19:00:00.000Z');
    expect(plan.compareRange.start).toBe('2024-12-31T19:00:00.000Z');
    expect(plan.compareRange.end.slice(0, 10)).toBe('2025-10-14');
    expect(plan.compareLabel).toBe('the same dates last year');
  });

  it('on Jan 1 the new year is its own (partial) bucket', () => {
    const plan = getPeriodPlan('yearly', {
      now: new Date('2026-12-31T20:00:00Z'), // Jan 1 2027, 01:00 in Karachi
      timezone: KARACHI,
      firstDataAt: new Date('2026-06-01T00:00:00Z'),
    });
    expect(plan.buckets.map((b) => b.key)).toEqual(['2026-01-01', '2027-01-01']);
    expect(plan.buckets[0]?.partial).toBe(false);
  });

  it('with no data yet shows only this year', () => {
    expect(getPeriodPlan('yearly', { now: NOW, timezone: KARACHI }).buckets).toHaveLength(1);
  });
});

describe('lastDays', () => {
  it('lists the last N local days', () => {
    const { keys, range } = lastDays(14, { now: NOW, timezone: KARACHI });
    expect(keys).toHaveLength(14);
    expect(keys[0]).toBe('2026-10-01');
    expect(keys[13]).toBe('2026-10-14');
    expect(range.start).toBe('2026-09-30T19:00:00.000Z');
  });
});

describe('changePct', () => {
  it('rounds to one decimal and is null without a previous value', () => {
    expect(changePct(150, 100)).toBe(50);
    expect(changePct(90, 120)).toBe(-25);
    expect(changePct(1, 3)).toBe(-66.7);
    expect(changePct(5, 0)).toBeNull();
  });
});
