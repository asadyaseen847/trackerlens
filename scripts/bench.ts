/**
 * npm run bench — Phase 6 performance check (BUILD_PROMPT §17): stats queries on ~1M page views.
 *
 * Loads demo traffic into an in-memory Postgres (PGlite, all migrations) and times the same
 * service calls the dashboard makes. PGlite is single-threaded WebAssembly, so real Supabase
 * Postgres is faster; passing here is a conservative result. BENCH_SCALE (default 1.8 ≈ 1M
 * page views) and BENCH_DAYS (default 548).
 */
process.env['NODE_ENV'] ??= 'test';

const { freshDatabase, pgliteRepo } = await import('../apps/api/test/pgliteRepo.js');
const { seedDemo } = await import('../apps/api/test/seedPglite.js');
const { getOverview, getBreakdown, getLive } =
  await import('../apps/api/src/services/stats.service.js');

const db = await freshDatabase();
const repo = pgliteRepo(db);
const t0 = Date.now();
const seed = await seedDemo(db, {
  days: Number(process.env['BENCH_DAYS'] ?? 548),
  scale: Number(process.env['BENCH_SCALE'] ?? 1.8),
});
await db.query('analyze');
console.log(
  `Loaded ${seed.visits.toLocaleString()} visits / ${seed.pageViews.toLocaleString()} page views in ${Math.round((Date.now() - t0) / 1000)} s\n`,
);

const ws = seed.workspaceId;
const cases: Array<[string, () => Promise<unknown>]> = [
  ['overview daily, all sites', () => getOverview(repo, ws, { period: 'daily' })],
  ['overview weekly, all sites', () => getOverview(repo, ws, { period: 'weekly' })],
  ['overview monthly, all sites', () => getOverview(repo, ws, { period: 'monthly' })],
  ['overview yearly, all sites', () => getOverview(repo, ws, { period: 'yearly' })],
  [
    'overview monthly, 1 site + filters',
    () =>
      getOverview(repo, ws, {
        period: 'monthly',
        site: seed.siteIds[0],
        channels: 'social,search',
        device: 'phone',
        country: 'US',
      }),
  ],
  [
    'breakdown platform, monthly',
    () => getBreakdown(repo, ws, { period: 'monthly', dimension: 'platform' }),
  ],
  [
    'breakdown page, monthly',
    () => getBreakdown(repo, ws, { period: 'monthly', dimension: 'page' }),
  ],
  [
    'breakdown page, monthly, phones',
    () => getBreakdown(repo, ws, { period: 'monthly', dimension: 'page', device: 'phone' }),
  ],
  [
    'breakdown campaign, yearly',
    () => getBreakdown(repo, ws, { period: 'yearly', dimension: 'campaign' }),
  ],
  [
    'breakdown country, monthly',
    () => getBreakdown(repo, ws, { period: 'monthly', dimension: 'country' }),
  ],
  ['live', () => getLive(repo, ws, {})],
];

let worst = 0;
for (const [name, run] of cases) {
  await run(); // warm up
  const times: number[] = [];
  for (let i = 0; i < 3; i++) {
    const s = performance.now();
    await run();
    times.push(performance.now() - s);
  }
  const median = times.sort((a, b) => a - b)[1]!;
  worst = Math.max(worst, median);
  console.log(`${median < 500 ? '✓' : '✗'} ${name.padEnd(38)} ${median.toFixed(0).padStart(5)} ms`);
}
console.log(`\nSlowest: ${worst.toFixed(0)} ms (target < 500 ms)`);
process.exit(worst < 500 ? 0 : 1);

export {};
