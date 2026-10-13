import type { PGlite } from '@electric-sql/pglite';
import { hash } from 'bcryptjs';
import {
  DEMO_SITES,
  generateDemoTraffic,
  type DemoPageView,
  type DemoVisit,
} from '../../../scripts/demo/generate.js';

const VISIT_COLUMNS = [
  'id',
  'site_id',
  'visitor_hash',
  'started_at',
  'last_seen_at',
  'pageview_count',
  'entry_path',
  'exit_path',
  'channel_id',
  'platform_id',
  'source_detail',
  'is_paid',
  'referrer_host',
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_term',
  'utm_content',
  'country_code',
  'device',
  'browser',
  'os',
] as const;
const PAGE_VIEW_COLUMNS = ['visit_id', 'site_id', 'viewed_at', 'path'] as const;

async function insertRows<T extends Record<string, unknown>>(
  db: PGlite,
  table: string,
  columns: readonly (keyof T & string)[],
  rows: T[],
) {
  // Modest statements: PGlite (WASM) is happier with a few thousand parameters at a time.
  const perStatement = Math.floor(5_000 / columns.length);
  for (let i = 0; i < rows.length; i += perStatement) {
    const chunk = rows.slice(i, i + perStatement);
    const params: unknown[] = [];
    const values = chunk
      .map((row) => `(${columns.map((c) => `$${params.push(row[c])}`).join(', ')})`)
      .join(', ');
    await db.query(`insert into ${table} (${columns.join(', ')}) values ${values}`, params);
  }
}

export interface SeedResult {
  email: string;
  password: string;
  workspaceId: string;
  siteIds: string[];
  visits: number;
  pageViews: number;
}

/** The demo account, workspace, 3 sites and their traffic, in a PGlite database. */
export async function seedDemo(
  db: PGlite,
  options: { now?: Date; days?: number; scale?: number; timezone?: string } = {},
): Promise<SeedResult> {
  const email = 'demo@example.com';
  const password = 'demo1234';
  const now = options.now ?? new Date();
  const user = (
    await db.query<{ id: string }>(
      'insert into users (email, password_hash, name) values ($1, $2, $3) returning id',
      [email, await hash(password, 4), 'Demo User'],
    )
  ).rows[0]!;
  const workspace = (
    await db.query<{ id: string }>(
      'insert into workspaces (name, timezone) values ($1, $2) returning id',
      ['My Brand', options.timezone ?? 'Asia/Karachi'],
    )
  ).rows[0]!;
  await db.query(
    `insert into workspace_members (workspace_id, user_id, role) values ($1, $2, 'owner')`,
    [workspace.id, user.id],
  );
  const siteIds: string[] = [];
  for (const s of DEMO_SITES) {
    const row = (
      await db.query<{ id: string }>(
        'insert into sites (workspace_id, domain, site_key) values ($1, $2, $3) returning id',
        [workspace.id, s.domain, s.siteKey],
      )
    ).rows[0]!;
    siteIds.push(row.id);
  }

  const totals = await generateDemoTraffic({
    siteIds,
    now,
    days: options.days ?? 548,
    scale: options.scale ?? 0.5,
    batchSize: 5000,
    onBatch: async (visits: DemoVisit[], pageViews: DemoPageView[]) => {
      await insertRows(db, 'visits', VISIT_COLUMNS, visits as unknown as Record<string, unknown>[]);
      await insertRows(
        db,
        'page_views',
        PAGE_VIEW_COLUMNS,
        pageViews as unknown as Record<string, unknown>[],
      );
    },
  });

  await db.query(
    `update sites s set first_event_at = v.first, last_event_at = v.last
     from (select site_id, min(started_at) first, max(last_seen_at) last from visits group by 1) v
     where v.site_id = s.id`,
  );
  // Bulk inserts skip record_page_view, so build the daily rollup from the raw rows.
  await db.query('select rebuild_daily_stats($1::uuid[])', [siteIds]);

  return {
    email,
    password,
    workspaceId: workspace.id,
    siteIds,
    visits: totals.visits,
    pageViews: totals.pageViews,
  };
}
