import type { PostgrestError } from '@supabase/supabase-js';
import { UniqueViolationError, type Repo } from './repo.js';
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
  };
}
