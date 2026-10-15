import type { PostgrestError } from '@supabase/supabase-js';
import {
  recordPageViewArgs,
  filterArgs,
  statsArgs,
  toBreakdownRow,
  toKpis,
  UniqueViolationError,
  type Repo,
} from './repo.js';
import { getDb } from './supabase.js';

/** Turn a PostgREST error into an exception; Postgres 23505 becomes UniqueViolationError. */
function fail(error: PostgrestError): never {
  if (error.code === '23505') throw new UniqueViolationError(error.message);
  throw new Error(`Database error (${error.code}): ${error.message}`);
}

function must<T>(result: { data: T | null; error: PostgrestError | null }): T {
  if (result.error) fail(result.error);
  if (result.data === null) throw new Error('Database returned no row');
  return result.data;
}

function maybe<T>(result: { data: T | null; error: PostgrestError | null }): T | null {
  if (result.error) fail(result.error);
  return result.data;
}

function ok(result: { error: PostgrestError | null }): void {
  if (result.error) fail(result.error);
}

/** Repo backed by Supabase (service-role client). The client is created on first use. */
export function supabaseRepo(): Repo {
  return {
    async ping() {
      ok(await getDb().from('workspaces').select('id', { head: true, count: 'exact' }));
    },

    /* ---------- accounts ---------- */
    async findUserByEmail(email) {
      return maybe(await getDb().from('users').select('*').eq('email', email).maybeSingle());
    },
    async findUserById(id) {
      return maybe(await getDb().from('users').select('*').eq('id', id).maybeSingle());
    },
    async createUser(input) {
      return must(await getDb().from('users').insert(input).select('*').single());
    },
    async deleteUser(id) {
      ok(await getDb().from('users').delete().eq('id', id));
    },
    async createWorkspace(input) {
      return must(await getDb().from('workspaces').insert(input).select('*').single());
    },
    async findWorkspaceById(id) {
      return maybe(await getDb().from('workspaces').select('*').eq('id', id).maybeSingle());
    },
    async updateWorkspace(id, patch) {
      return must(await getDb().from('workspaces').update(patch).eq('id', id).select('*').single());
    },
    async deleteWorkspace(id) {
      ok(await getDb().from('workspaces').delete().eq('id', id));
    },
    async addMember(input) {
      ok(await getDb().from('workspace_members').insert(input));
    },
    async findMembershipForUser(userId) {
      return maybe(
        await getDb()
          .from('workspace_members')
          .select('*')
          .eq('user_id', userId)
          .order('created_at', { ascending: true })
          .limit(1)
          .maybeSingle(),
      );
    },

    /* ---------- sites ---------- */
    async listSites(workspaceId) {
      return must(
        await getDb()
          .from('sites')
          .select('*')
          .eq('workspace_id', workspaceId)
          .order('created_at', { ascending: true }),
      );
    },
    async findSiteById(id) {
      return maybe(await getDb().from('sites').select('*').eq('id', id).maybeSingle());
    },
    async findSiteByKey(siteKey) {
      return maybe(await getDb().from('sites').select('*').eq('site_key', siteKey).maybeSingle());
    },
    async findSiteByDomain(workspaceId, domain) {
      return maybe(
        await getDb()
          .from('sites')
          .select('*')
          .eq('workspace_id', workspaceId)
          .eq('domain', domain)
          .maybeSingle(),
      );
    },
    async siteKeyExists(siteKey) {
      const result = await getDb()
        .from('sites')
        .select('id', { head: true, count: 'exact' })
        .eq('site_key', siteKey);
      ok(result);
      return (result.count ?? 0) > 0;
    },
    async createSite(input) {
      return must(await getDb().from('sites').insert(input).select('*').single());
    },
    async updateSite(id, patch) {
      return must(await getDb().from('sites').update(patch).eq('id', id).select('*').single());
    },
    async deleteSite(id) {
      ok(await getDb().from('sites').delete().eq('id', id));
    },

    /* ---------- tracking ---------- */
    async getOrCreateSalt(day, candidate) {
      return must(await getDb().rpc('get_or_create_salt', { p_day: day, p_candidate: candidate }));
    },
    async cleanupSalts(beforeDay) {
      return must(await getDb().rpc('cleanup_salts', { p_before: beforeDay }));
    },
    async recordPageView(input) {
      const rows = must(await getDb().rpc('record_page_view', recordPageViewArgs(input)));
      const row = rows[0];
      if (!row) throw new Error('record_page_view returned no row');
      return { visitId: row.o_visit_id, newVisit: row.o_new_visit };
    },

    /* ---------- stats ---------- */
    async statsKpis(q) {
      return toKpis(must(await getDb().rpc('stats_kpis', statsArgs(q)))[0]);
    },
    async statsSeries(q, unit) {
      const rows = must(await getDb().rpc('stats_series', { ...statsArgs(q), p_unit: unit }));
      return rows.map((r) => ({
        bucket: r.bucket,
        channelId: r.channel_id,
        visits: Number(r.visits),
      }));
    },
    async statsBreakdown(q, dimension, limit) {
      const rows = must(
        await getDb().rpc('stats_breakdown', {
          ...statsArgs(q),
          p_dimension: dimension,
          p_limit: limit,
        }),
      );
      return rows.map(toBreakdownRow);
    },
    async statsSiteDaily(siteIds, fromDay, toDay) {
      const rows = must(
        await getDb().rpc('stats_site_daily', {
          p_site_ids: siteIds,
          p_from: fromDay,
          p_to: toDay,
        }),
      );
      return rows.map((r) => ({ siteId: r.site_id, day: r.day, visits: Number(r.visits) }));
    },
    async statsLive(q, since) {
      return Number(must(await getDb().rpc('stats_live', { ...filterArgs(q), p_since: since })));
    },
    async rebuildDailyStats(siteIds) {
      return Number(must(await getDb().rpc('rebuild_daily_stats', { p_site_ids: siteIds })));
    },

    /* ---------- social ---------- */
    async listSocialAccounts(workspaceId) {
      return must(
        await getDb()
          .from('social_accounts')
          .select('*')
          .eq('workspace_id', workspaceId)
          .order('created_at', { ascending: true }),
      );
    },
    async listSocialAccountsToSync() {
      return must(await getDb().from('social_accounts').select('*').eq('status', 'connected'));
    },
    async findSocialAccountById(id) {
      return maybe(await getDb().from('social_accounts').select('*').eq('id', id).maybeSingle());
    },
    async upsertSocialAccount(input) {
      return must(
        await getDb()
          .from('social_accounts')
          .upsert(input, { onConflict: 'workspace_id,platform_id,external_id' })
          .select('*')
          .single(),
      );
    },
    async updateSocialAccount(id, patch) {
      return must(
        await getDb().from('social_accounts').update(patch).eq('id', id).select('*').single(),
      );
    },
    async deleteSocialAccount(id) {
      ok(await getDb().from('social_accounts').delete().eq('id', id));
    },
    async saveSocialTokens(input) {
      ok(
        await getDb()
          .from('social_account_tokens')
          .upsert(input, { onConflict: 'social_account_id' }),
      );
    },
    async getSocialTokens(socialAccountId) {
      return maybe(
        await getDb()
          .from('social_account_tokens')
          .select('*')
          .eq('social_account_id', socialAccountId)
          .maybeSingle(),
      );
    },
    async upsertSocialDailyStats(rows) {
      // PostgREST caps request sizes; 500 rows per call is well within it.
      for (let i = 0; i < rows.length; i += 500) {
        ok(
          await getDb()
            .from('social_daily_stats')
            .upsert(rows.slice(i, i + 500), { onConflict: 'social_account_id,day' }),
        );
      }
    },
    async listSocialDailyStats(accountIds, fromDay, toDay) {
      if (accountIds.length === 0) return [];
      const out = [];
      // Page through: PostgREST returns at most 1000 rows per request by default.
      for (let from = 0; ; from += 1000) {
        const page = must(
          await getDb()
            .from('social_daily_stats')
            .select('*')
            .in('social_account_id', accountIds)
            .gte('day', fromDay)
            .lte('day', toDay)
            .order('day', { ascending: true })
            .order('social_account_id', { ascending: true })
            .range(from, from + 999),
        );
        out.push(...page);
        if (page.length < 1000) break;
      }
      return out;
    },

    /* ---------- retention ---------- */
    async purgeExpiredData() {
      const rows = must(await getDb().rpc('purge_expired_data', {}));
      const row = rows[0];
      return {
        visitsDeleted: Number(row?.visits_deleted ?? 0),
        pageViewsDeleted: Number(row?.page_views_deleted ?? 0),
      };
    },

    /* ---------- waitlist ---------- */
    async joinWaitlist(input) {
      ok(
        await getDb()
          .from('waitlist_signups')
          .upsert(input, { onConflict: 'email', ignoreDuplicates: true }),
      );
    },
  };
}
