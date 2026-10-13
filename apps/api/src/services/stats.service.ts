import {
  breakdownQuerySchema,
  changePct,
  CHANNELS,
  getPeriodPlan,
  lastDays,
  LIVE_WINDOW_MS,
  statsQuerySchema,
  type BreakdownResponse,
  type BreakdownRow,
  type Channel,
  type Kpi,
  type OverviewResponse,
  type StatsQueryParams,
} from '@audience/shared';
import type { Repo, SiteRow, StatsFilters, StatsQuery } from '../db/repo.js';
import { HttpError } from '../utils/httpError.js';

export interface Scope {
  sites: SiteRow[];
  siteIds: string[];
  timezone: string;
  firstDataAt: Date | null;
}

/**
 * The sites a stats request covers: every site in the workspace, or one site that must
 * belong to it (§10). Other workspaces' ids answer 404 like missing ones.
 */
export async function resolveScope(repo: Repo, workspaceId: string, site: string): Promise<Scope> {
  const [workspace, all] = await Promise.all([
    repo.findWorkspaceById(workspaceId),
    repo.listSites(workspaceId),
  ]);
  if (!workspace) throw new HttpError(404, 'Workspace not found.');
  const sites = site === 'all' ? all : all.filter((s) => s.id === site);
  if (site !== 'all' && sites.length === 0) throw new HttpError(404, 'Website not found.');
  const firsts = sites
    .map((s) => s.first_event_at)
    .filter((v): v is string => v !== null)
    .sort();
  return {
    sites,
    siteIds: sites.map((s) => s.id),
    timezone: workspace.timezone,
    firstDataAt: firsts[0] ? new Date(firsts[0]) : null,
  };
}

function kpi(value: number, previous: number): Kpi {
  return { value, previous, changePct: changePct(value, previous) };
}

function filtersOf(params: StatsQueryParams, scope: Scope) {
  return {
    siteIds: scope.siteIds,
    channels: params.channels ?? null,
    device: params.device ?? null,
    country: params.country ?? null,
  };
}

function queryOf(filters: StatsFilters, days: { from: string; to: string }): StatsQuery {
  return { ...filters, fromDay: days.from, toDay: days.to };
}

/**
 * GET /stats/overview: KPIs vs before, plus visits per bucket and channel (§10). Everything
 * comes from the daily rollup (daily_stats), which covers every filter.
 */
export async function getOverview(
  repo: Repo,
  workspaceId: string,
  query: unknown,
  now = new Date(),
): Promise<OverviewResponse> {
  const params = statsQuerySchema.parse(query);
  const scope = await resolveScope(repo, workspaceId, params.site);
  const plan = getPeriodPlan(params.period, {
    now,
    timezone: scope.timezone,
    firstDataAt: scope.firstDataAt,
  });
  const filters = filtersOf(params, scope);
  const seriesDays = { from: plan.buckets[0]?.key ?? plan.days.from, to: plan.days.to };

  const [cur, prev, series] = await Promise.all([
    repo.statsKpis(queryOf(filters, plan.days)),
    repo.statsKpis(queryOf(filters, plan.compareDays)),
    repo.statsSeries(queryOf(filters, seriesDays), plan.unit),
  ]);

  const byBucket = new Map<string, Record<Channel, number>>();
  for (const b of plan.buckets) {
    byBucket.set(
      b.key,
      Object.fromEntries(CHANNELS.map((c) => [c.id, 0])) as Record<Channel, number>,
    );
  }
  for (const row of series) {
    const bucket = byBucket.get(row.bucket);
    if (bucket && row.channelId in bucket) bucket[row.channelId as Channel] += row.visits;
  }

  return {
    range: plan.range,
    compareRange: plan.compareRange,
    rangeLabel: plan.rangeLabel,
    compareLabel: plan.compareLabel,
    unit: plan.unit,
    hasData: scope.firstDataAt !== null,
    kpis: {
      visits: kpi(cur.visits, prev.visits),
      visitors: kpi(cur.visitors, prev.visitors),
      pageviews: kpi(cur.pageviews, prev.pageviews),
    },
    series: plan.buckets.map((b) => ({
      start: b.start,
      label: b.label,
      fullLabel: b.fullLabel,
      partial: b.partial,
      byChannel: byBucket.get(b.key)!,
    })),
  };
}

/**
 * GET /stats/breakdown: top rows for one dimension with share and change (§10). Pages count
 * page views; every other dimension counts visits. Country and device lists ignore their own
 * filter so every option stays visible (the UI dims the unselected ones).
 */
export async function getBreakdown(
  repo: Repo,
  workspaceId: string,
  query: unknown,
  now = new Date(),
): Promise<BreakdownResponse> {
  const params = breakdownQuerySchema.parse(query);
  const scope = await resolveScope(repo, workspaceId, params.site);
  const plan = getPeriodPlan(params.period, {
    now,
    timezone: scope.timezone,
    firstDataAt: scope.firstDataAt,
  });
  const filters = filtersOf(params, scope);
  const totalFilters: StatsFilters = {
    ...filters,
    device: params.dimension === 'device' ? null : filters.device,
    country: params.dimension === 'country' ? null : filters.country,
  };

  const [rows, previousRows, totals] = await Promise.all([
    repo.statsBreakdown(queryOf(filters, plan.days), params.dimension, params.limit),
    repo.statsBreakdown(queryOf(filters, plan.compareDays), params.dimension, 250),
    repo.statsKpis(queryOf(totalFilters, plan.days)),
  ]);
  const previous = new Map(previousRows.map((r) => [r.key, r.value]));
  const total = params.dimension === 'page' ? totals.pageviews : totals.visits;

  return {
    rows: rows.map((r): BreakdownRow => {
      const prev = previous.get(r.key) ?? 0;
      return {
        key: r.key,
        label: r.label,
        ...(r.detail ? { detail: r.detail } : {}),
        ...(r.channelId ? { channel: r.channelId as Channel } : {}),
        value: r.value,
        share: total > 0 ? r.value / total : 0,
        previous: prev,
        changePct: changePct(r.value, prev),
      };
    }),
  };
}

/** GET /stats/live: distinct visitors seen in the last 5 minutes (§9). */
export async function getLive(
  repo: Repo,
  workspaceId: string,
  query: unknown,
  now = new Date(),
): Promise<{ count: number }> {
  const params = statsQuerySchema.parse(query);
  const scope = await resolveScope(repo, workspaceId, params.site);
  const since = new Date(now.getTime() - LIVE_WINDOW_MS).toISOString();
  return { count: await repo.statsLive(filtersOf(params, scope), since) };
}

/** Quote a CSV field when needed. */
function csvField(value: string | number): string {
  const s = String(value);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(header: string[], rows: Array<Array<string | number>>): string {
  return [header, ...rows].map((r) => r.map(csvField).join(',')).join('\r\n') + '\r\n';
}

/** GET /stats/export.csv: one row per bucket and channel, same filters (§10). */
export async function exportCsv(
  repo: Repo,
  workspaceId: string,
  query: unknown,
  now = new Date(),
): Promise<string> {
  const overview = await getOverview(repo, workspaceId, query, now);
  const params = statsQuerySchema.parse(query);
  const channels = CHANNELS.filter((c) => !params.channels || params.channels.includes(c.id));
  const rows: Array<Array<string | number>> = [];
  for (const bucket of overview.series) {
    for (const c of channels) {
      rows.push([bucket.start.slice(0, 10), bucket.fullLabel, c.label, bucket.byChannel[c.id]]);
    }
  }
  return toCsv(['bucket_start', 'period', 'channel', 'visits'], rows);
}

/** Visits in the last 30 days and a 14-day sparkline per site, for the site cards (§10). */
export async function siteCardStats(
  repo: Repo,
  sites: SiteRow[],
  timezone: string,
  now = new Date(),
): Promise<Map<string, { visits30d: number; sparkline: number[] }>> {
  const days = lastDays(30, { now, timezone });
  const rows = sites.length
    ? await repo.statsSiteDaily(
        sites.map((s) => s.id),
        days.keys[0]!,
        days.keys[days.keys.length - 1]!,
      )
    : [];
  const counts = new Map<string, number>();
  for (const r of rows) counts.set(`${r.siteId}|${r.day}`, r.visits);
  return new Map(
    sites.map((s) => {
      const daily = days.keys.map((k) => counts.get(`${s.id}|${k}`) ?? 0);
      return [s.id, { visits30d: daily.reduce((a, b) => a + b, 0), sparkline: daily.slice(-14) }];
    }),
  );
}
