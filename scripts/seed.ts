/**
 * npm run seed -- --yes
 *
 * Fills the Supabase database in apps/api/.env with demo data (BUILD_PROMPT §15): a demo
 * account, a workspace with 3 sites (mybrand.com, shop.mybrand.com, blog.mybrand.com),
 * 18 months of deterministic visits and page views, and sample social accounts.
 *
 * Safety: refuses NODE_ENV=production, needs --yes, and refuses if the demo email exists.
 * Options (environment): SEED_EMAIL, SEED_PASSWORD, SEED_DAYS (548), SEED_SCALE (0.5).
 */
import { hash } from 'bcryptjs';

process.env['SOCIAL_MOCK'] ??= 'true';

const { createClient } = await import('@supabase/supabase-js');
const { DEMO_SITES, generateDemoTraffic } = await import('./demo/generate.js');
const { supabaseRepo } = await import('../apps/api/src/db/supabaseRepo.js');
const { encryptToken } = await import('../apps/api/src/social/crypto.js');
const { syncAccount } = await import('../apps/api/src/social/sync.js');
const { generateSiteKey } = await import('../apps/api/src/services/sites.service.js');

async function main() {
  const url = process.env['SUPABASE_URL'];
  const key = process.env['SUPABASE_SERVICE_ROLE_KEY'];
  if (!url || !key)
    throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set (in apps/api/.env)');
  if (process.env['NODE_ENV'] === 'production')
    throw new Error('Refusing to seed with NODE_ENV=production');
  if (!process.argv.includes('--yes')) {
    throw new Error(
      `This adds a demo account and ~130,000 visits to ${url}.\n` +
        'Anyone who knows the demo password can log in to it. Run again with --yes to continue:\n' +
        '  npm run seed -- --yes',
    );
  }

  const email = (process.env['SEED_EMAIL'] ?? 'demo@example.com').toLowerCase();
  const password = process.env['SEED_PASSWORD'] ?? 'demo1234';
  const db = createClient(url, key, { auth: { persistSession: false } });
  const repo = supabaseRepo();
  const check = <T>(r: { data: T; error: { message: string } | null }, what: string): T => {
    if (r.error) throw new Error(`${what}: ${r.error.message}`);
    return r.data;
  };

  if (await repo.findUserByEmail(email)) {
    throw new Error(`${email} already exists. Delete that account first, or set SEED_EMAIL.`);
  }

  console.log(`Creating ${email}…`);
  const user = await repo.createUser({
    email,
    password_hash: await hash(password, 12),
    name: 'Demo User',
  });
  const workspace = await repo.createWorkspace({ name: 'My Brand', timezone: 'Asia/Karachi' });
  await repo.addMember({ workspace_id: workspace.id, user_id: user.id, role: 'owner' });

  const siteIds: string[] = [];
  for (const s of DEMO_SITES) {
    // Site keys are unique across all workspaces: use a fresh one if a demo key is taken.
    const site = await repo.createSite({
      workspace_id: workspace.id,
      domain: s.domain,
      site_key: (await repo.siteKeyExists(s.siteKey)) ? generateSiteKey() : s.siteKey,
    });
    siteIds.push(site.id);
  }

  console.log('Generating and uploading traffic (a few minutes)…');
  let batches = 0;
  const totals = await generateDemoTraffic({
    siteIds,
    now: new Date(),
    days: Number(process.env['SEED_DAYS'] ?? 548),
    scale: Number(process.env['SEED_SCALE'] ?? 0.5),
    batchSize: 1000,
    onBatch: async (visits, pageViews) => {
      check(await db.from('visits').insert(visits), 'insert visits');
      for (let i = 0; i < pageViews.length; i += 2000) {
        check(
          await db.from('page_views').insert(pageViews.slice(i, i + 2000)),
          'insert page views',
        );
      }
      batches += 1;
      if (batches % 20 === 0) process.stdout.write(`  ${batches * 1000} visits…\n`);
    },
  });

  // First and last visit per site, so cards say "Live".
  for (const siteId of siteIds) {
    const first = check(
      await db
        .from('visits')
        .select('started_at')
        .eq('site_id', siteId)
        .order('started_at')
        .limit(1),
      'first visit',
    );
    const last = check(
      await db
        .from('visits')
        .select('last_seen_at')
        .eq('site_id', siteId)
        .order('last_seen_at', { ascending: false })
        .limit(1),
      'last visit',
    );
    await repo.updateSite(siteId, {
      first_event_at: first?.[0]?.started_at ?? null,
      last_event_at: last?.[0]?.last_seen_at ?? null,
    });
  }

  console.log('Building the daily rollup…');
  await repo.rebuildDailyStats(siteIds);

  console.log('Connecting sample social accounts…');
  const deps = {
    repo,
    authRateLimit: { windowMs: 60_000, max: 10 },
    collectRateLimit: { windowMs: 60_000, max: 300 },
    cronSecret: undefined,
    socialMock: true,
    encryptionKey: process.env['ENCRYPTION_KEY'],
    appUrl: process.env['APP_URL'] ?? 'http://localhost:5173',
  };
  for (const platform of ['instagram', 'facebook', 'youtube', 'linkedin', 'x'] as const) {
    const account = await repo.upsertSocialAccount({
      workspace_id: workspace.id,
      platform_id: platform,
      external_id: `mock-${platform}`,
      handle: 'mybrand',
      name: 'My Brand (sample)',
      status: 'connected',
    });
    await repo.saveSocialTokens({
      social_account_id: account.id,
      access_token_enc: encryptToken(`mock-${platform}-access`, deps.encryptionKey),
      scopes: ['mock'],
    });
    await syncAccount(deps, account);
  }

  console.log(
    `Done: ${totals.visits.toLocaleString()} visits, ${totals.pageViews.toLocaleString()} page views.\n` +
      `Log in as ${email} / ${password}`,
  );
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});

export {};
