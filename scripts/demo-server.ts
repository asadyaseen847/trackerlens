/**
 * Local demo API: the real Express app on an in-memory Postgres (PGlite) with every migration,
 * filled with deterministic demo traffic. No Supabase needed.
 *
 *   npm run dev:demo      → http://localhost:5173, log in as demo@example.com / demo1234
 *
 * Environment: DEMO_SEED=0 starts empty (used by the end-to-end test), DEMO_DAYS (default 548),
 * DEMO_SCALE (default 0.5), PORT (default 4000).
 */

// Before the app is imported: no Supabase variables are needed in this mode.
process.env['NODE_ENV'] ??= 'test';

const { createApp } = await import('../apps/api/src/createApp.js');
const { freshDatabase, pgliteRepo } = await import('../apps/api/test/pgliteRepo.js');
const { seedDemo } = await import('../apps/api/test/seedPglite.js');
const { connectMockAccounts } = await import('../apps/api/test/seedSocial.js');

const port = Number(process.env['PORT'] ?? 4000);
const db = await freshDatabase();
const repo = pgliteRepo(db);

if (process.env['DEMO_SEED'] !== '0') {
  const started = Date.now();
  const seed = await seedDemo(db, {
    days: Number(process.env['DEMO_DAYS'] ?? 548),
    scale: Number(process.env['DEMO_SCALE'] ?? 0.5),
  });
  await connectMockAccounts(repo, seed.workspaceId);
  console.log(
    `Seeded ${seed.visits.toLocaleString()} visits and ${seed.pageViews.toLocaleString()} page views ` +
      `in ${Math.round((Date.now() - started) / 1000)} s. Log in as ${seed.email} / ${seed.password}`,
  );
}

createApp({ repo, cronSecret: 'demo-cron-secret', socialMock: true }).listen(port, () => {
  console.log(`Demo API on http://localhost:${port} (in-memory Postgres)`);
});

export {};
