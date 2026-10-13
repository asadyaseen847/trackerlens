import { PGlite, types } from '@electric-sql/pglite';
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { recordPageViewArgs, statsArgs, UniqueViolationError, type Repo } from '../src/db/repo.js';

const MIGRATIONS_DIR = fileURLToPath(new URL('../../../supabase/migrations/', import.meta.url));

/** Return timestamps as ISO strings and dates as YYYY-MM-DD, like PostgREST does. */
const parsers = {
  [types.TIMESTAMPTZ]: (v: string) => new Date(v).toISOString(),
  [types.TIMESTAMP]: (v: string) => v,
  [types.DATE]: (v: string) => v,
  [types.INT8]: (v: string) => Number(v),
};

let template: Promise<Blob> | undefined;

/** A fresh database with every migration applied (built once, then cloned per call). */
export async function freshDatabase(): Promise<PGlite> {
  template ??= (async () => {
    const db = await PGlite.create();
    for (const file of readdirSync(MIGRATIONS_DIR)
      .filter((f) => f.endsWith('.sql'))
      .sort()) {
      await db.exec(readFileSync(MIGRATIONS_DIR + file, 'utf8'));
    }
    const dump = await db.dumpDataDir('none');
    await db.close();
    return dump;
  })();
  return PGlite.create({ loadDataDir: await template, parsers });
}

type Row = Record<string, unknown>;

/**
 * Repo backed by PGlite: real Postgres (WASM) in memory, with the same migrations and SQL
 * functions as Supabase. Used by the API tests and the end-to-end test server.
 */
export function pgliteRepo(db: PGlite): Repo & { db: PGlite } {
  async function run<T = Row>(sql: string, params: unknown[] = []): Promise<T[]> {
    try {
      return (await db.query<T>(sql, params)).rows;
    } catch (err) {
      if ((err as { code?: string }).code === '23505') throw new UniqueViolationError();
      throw err;
    }
  }
  const one = async <T = Row>(sql: string, params: unknown[] = []) =>
    (await run<T>(sql, params))[0] ?? null;
  const must = async <T = Row>(sql: string, params: unknown[] = []) => {
    const row = await one<T>(sql, params);
    if (!row) throw new Error('Database returned no row');
    return row;
  };

  /** insert into <table> (only the defined keys) ... returning * */
  function insertSql(table: string, input: Row, suffix = 'returning *') {
    const keys = Object.keys(input).filter((k) => input[k] !== undefined);
    const cols = keys.join(', ');
    const vals = keys.map((_, i) => `$${i + 1}`).join(', ');
    return {
      sql: `insert into ${table} (${cols}) values (${vals}) ${suffix}`,
      params: keys.map((k) => input[k]),
    };
  }
  function updateSql(table: string, id: string, patch: Row, idColumn = 'id') {
    const keys = Object.keys(patch).filter((k) => patch[k] !== undefined);
    const sets = keys.map((k, i) => `${k} = $${i + 2}`).join(', ');
    return {
      sql: `update ${table} set ${sets || `${idColumn} = ${idColumn}`} where ${idColumn} = $1 returning *`,
      params: [id, ...keys.map((k) => patch[k])],
    };
  }
  /** select * from fn(name => $1, ...) with named arguments, like supabase-js rpc(). */
  async function rpc<T = Row>(fn: string, args: Row): Promise<T[]> {
    const keys = Object.keys(args).filter((k) => args[k] !== undefined);
    const call = keys.map((k, i) => `${k} => $${i + 1}`).join(', ');
    return run<T>(
      `select * from ${fn}(${call})`,
      keys.map((k) => args[k]),
    );
  }

  const repo: Repo & { db: PGlite } = {
    db,
    async ping() {
      await run('select 1');
    },

    findUserByEmail: (email) => one('select * from users where email = $1', [email]),
    findUserById: (id) => one('select * from users where id = $1', [id]),
    async createUser(input) {
      const q = insertSql('users', input);
      return must(q.sql, q.params);
    },
    async deleteUser(id) {
      await run('delete from users where id = $1', [id]);
    },
    async createWorkspace(input) {
      const q = insertSql('workspaces', input);
      return must(q.sql, q.params);
    },
    findWorkspaceById: (id) => one('select * from workspaces where id = $1', [id]),
    async updateWorkspace(id, patch) {
      const q = updateSql('workspaces', id, patch);
      return must(q.sql, q.params);
    },
    async deleteWorkspace(id) {
      await run('delete from workspaces where id = $1', [id]);
    },
    async addMember(input) {
      const q = insertSql('workspace_members', input, '');
      await run(q.sql, q.params);
    },
    findMembershipForUser: (userId) =>
      one('select * from workspace_members where user_id = $1 order by created_at limit 1', [
        userId,
      ]),

    listSites: (workspaceId) =>
      run('select * from sites where workspace_id = $1 order by created_at', [workspaceId]),
    findSiteById: (id) => one('select * from sites where id = $1', [id]),
    findSiteByKey: (key) => one('select * from sites where site_key = $1', [key]),
    findSiteByDomain: (workspaceId, domain) =>
      one('select * from sites where workspace_id = $1 and domain = $2', [workspaceId, domain]),
    async siteKeyExists(key) {
      return (await one('select 1 from sites where site_key = $1', [key])) !== null;
    },
    async createSite(input) {
      const q = insertSql('sites', input);
      return must(q.sql, q.params);
    },
    async updateSite(id, patch) {
      const q = updateSql('sites', id, patch);
      return must(q.sql, q.params);
    },
    async deleteSite(id) {
      await run('delete from sites where id = $1', [id]);
    },

    async getOrCreateSalt(day, candidate) {
      const [row] = await rpc<{ get_or_create_salt: string }>('get_or_create_salt', {
        p_day: day,
        p_candidate: candidate,
      });
      return row!.get_or_create_salt;
    },
    async cleanupSalts(beforeDay) {
      const [row] = await rpc<{ cleanup_salts: number }>('cleanup_salts', { p_before: beforeDay });
      return row!.cleanup_salts;
    },
    async recordPageView(input) {
      const [row] = await rpc<{ o_visit_id: string; o_new_visit: boolean }>(
        'record_page_view',
        recordPageViewArgs(input),
      );
      return { visitId: row!.o_visit_id, newVisit: row!.o_new_visit };
    },

    async statsKpis(q) {
      const [row] = await rpc<{ visits: number; visitors: number; pageviews: number }>(
        'stats_kpis',
        {
          ...statsArgs(q),
          p_start: q.start,
          p_end: q.end,
        },
      );
      return row ?? { visits: 0, visitors: 0, pageviews: 0 };
    },
    async statsSeries(q, unit, timezone) {
      const rows = await rpc<{ bucket: string; channel_id: string; visits: number }>(
        'stats_series',
        {
          ...statsArgs(q),
          p_start: q.start,
          p_end: q.end,
          p_unit: unit,
          p_tz: timezone,
        },
      );
      return rows.map((r) => ({ bucket: r.bucket, channelId: r.channel_id, visits: r.visits }));
    },
    async statsBreakdown(q, dimension, limit) {
      const rows = await rpc<{
        key: string;
        label: string;
        detail: string | null;
        channel_id: string | null;
        value: number;
      }>('stats_breakdown', {
        ...statsArgs(q),
        p_start: q.start,
        p_end: q.end,
        p_dimension: dimension,
        p_limit: limit,
      });
      return rows.map((r) => ({
        key: r.key,
        label: r.label,
        detail: r.detail,
        channelId: r.channel_id,
        value: r.value,
      }));
    },
    async statsLive(q, since) {
      const [row] = await rpc<{ stats_live: number }>('stats_live', {
        ...statsArgs(q),
        p_since: since,
      });
      return row!.stats_live;
    },
    async statsSiteDaily(siteIds, start, end, timezone) {
      const rows = await rpc<{ site_id: string; day: string; visits: number }>('stats_site_daily', {
        p_site_ids: siteIds,
        p_start: start,
        p_end: end,
        p_tz: timezone,
      });
      return rows.map((r) => ({ siteId: r.site_id, day: r.day, visits: r.visits }));
    },
    async statsVisitsByPlatform(siteIds, start, end, timezone, unit) {
      const rows = await rpc<{ platform_id: string; bucket: string; visits: number }>(
        'stats_visits_by_platform',
        { p_site_ids: siteIds, p_start: start, p_end: end, p_tz: timezone, p_unit: unit },
      );
      return rows.map((r) => ({ platformId: r.platform_id, bucket: r.bucket, visits: r.visits }));
    },

    listSocialAccounts: (workspaceId) =>
      run('select * from social_accounts where workspace_id = $1 order by created_at', [
        workspaceId,
      ]),
    listSocialAccountsToSync: () => run(`select * from social_accounts where status = 'connected'`),
    findSocialAccountById: (id) => one('select * from social_accounts where id = $1', [id]),
    async upsertSocialAccount(input) {
      const q = insertSql(
        'social_accounts',
        input,
        `on conflict (workspace_id, platform_id, external_id) do update set
           handle = excluded.handle, name = excluded.name, avatar_url = excluded.avatar_url,
           status = excluded.status
         returning *`,
      );
      return must(q.sql, q.params);
    },
    async updateSocialAccount(id, patch) {
      const q = updateSql('social_accounts', id, patch);
      return must(q.sql, q.params);
    },
    async deleteSocialAccount(id) {
      await run('delete from social_accounts where id = $1', [id]);
    },
    async saveSocialTokens(input) {
      const q = insertSql(
        'social_account_tokens',
        input,
        `on conflict (social_account_id) do update set
           access_token_enc = excluded.access_token_enc, refresh_token_enc = excluded.refresh_token_enc,
           expires_at = excluded.expires_at, scopes = excluded.scopes`,
      );
      await run(q.sql, q.params);
    },
    getSocialTokens: (id) =>
      one('select * from social_account_tokens where social_account_id = $1', [id]),
    async upsertSocialDailyStats(rows) {
      for (const r of rows) {
        await run(
          `insert into social_daily_stats (social_account_id, day, followers, views, engagements, link_clicks)
           values ($1, $2, $3, $4, $5, $6)
           on conflict (social_account_id, day) do update set followers = excluded.followers,
             views = excluded.views, engagements = excluded.engagements, link_clicks = excluded.link_clicks`,
          [
            r.social_account_id,
            r.day,
            r.followers ?? null,
            r.views ?? null,
            r.engagements ?? null,
            r.link_clicks ?? null,
          ],
        );
      }
    },
    listSocialDailyStats: (ids, fromDay, toDay) =>
      ids.length === 0
        ? Promise.resolve([])
        : run(
            `select * from social_daily_stats where social_account_id = any($1::uuid[])
             and day between $2 and $3 order by day, social_account_id`,
            [ids, fromDay, toDay],
          ),

    async purgeExpiredData() {
      const [row] = await rpc<{ visits_deleted: number; page_views_deleted: number }>(
        'purge_expired_data',
        {},
      );
      return {
        visitsDeleted: row?.visits_deleted ?? 0,
        pageViewsDeleted: row?.page_views_deleted ?? 0,
      };
    },
  };
  return repo;
}
