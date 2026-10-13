import { randomUUID } from 'node:crypto';
import {
  UniqueViolationError,
  type MemberRow,
  type Repo,
  type SiteRow,
  type UserRow,
  type WorkspaceRow,
} from '../src/db/repo.js';

/**
 * In-memory Repo for tests. Mirrors the Postgres constraints that matter to services:
 * unique emails, unique site keys, unique (workspace_id, domain), and ON DELETE CASCADE.
 */
export function memoryRepo(): Repo & {
  users: UserRow[];
  workspaces: WorkspaceRow[];
  members: MemberRow[];
  sites: SiteRow[];
} {
  const users: UserRow[] = [];
  const workspaces: WorkspaceRow[] = [];
  const members: MemberRow[] = [];
  const sites: SiteRow[] = [];
  const now = () => new Date().toISOString();
  const clone = <T>(row: T): T => structuredClone(row);
  const removeWhere = <T>(rows: T[], match: (row: T) => boolean) => {
    for (let i = rows.length - 1; i >= 0; i--) if (match(rows[i] as T)) rows.splice(i, 1);
  };

  return {
    users,
    workspaces,
    members,
    sites,

    async ping() {},

    async findUserByEmail(email) {
      const row = users.find((u) => u.email === email);
      return row ? clone(row) : null;
    },
    async findUserById(id) {
      const row = users.find((u) => u.id === id);
      return row ? clone(row) : null;
    },
    async createUser(input) {
      if (users.some((u) => u.email === input.email)) throw new UniqueViolationError();
      const row: UserRow = {
        id: input.id ?? randomUUID(),
        email: input.email,
        password_hash: input.password_hash,
        name: input.name,
        created_at: input.created_at ?? now(),
      };
      users.push(row);
      return clone(row);
    },
    async deleteUser(id) {
      removeWhere(users, (u) => u.id === id);
      removeWhere(members, (m) => m.user_id === id);
    },

    async createWorkspace(input) {
      const row: WorkspaceRow = {
        id: input.id ?? randomUUID(),
        name: input.name,
        timezone: input.timezone ?? 'UTC',
        retention_months: input.retention_months ?? 25,
        created_at: input.created_at ?? now(),
      };
      workspaces.push(row);
      return clone(row);
    },
    async findWorkspaceById(id) {
      const row = workspaces.find((w) => w.id === id);
      return row ? clone(row) : null;
    },
    async updateWorkspace(id, patch) {
      const row = workspaces.find((w) => w.id === id);
      if (!row) throw new Error('Database returned no row');
      Object.assign(row, patch);
      return clone(row);
    },
    async deleteWorkspace(id) {
      removeWhere(workspaces, (w) => w.id === id);
      removeWhere(members, (m) => m.workspace_id === id);
      removeWhere(sites, (s) => s.workspace_id === id);
    },

    async addMember(input) {
      members.push({
        workspace_id: input.workspace_id,
        user_id: input.user_id,
        role: input.role,
        created_at: input.created_at ?? now(),
      });
    },
    async findMembershipForUser(userId) {
      const row = members.find((m) => m.user_id === userId);
      return row ? clone(row) : null;
    },

    async listSites(workspaceId) {
      return sites.filter((s) => s.workspace_id === workspaceId).map(clone);
    },
    async findSiteById(id) {
      const row = sites.find((s) => s.id === id);
      return row ? clone(row) : null;
    },
    async findSiteByDomain(workspaceId, domain) {
      const row = sites.find((s) => s.workspace_id === workspaceId && s.domain === domain);
      return row ? clone(row) : null;
    },
    async siteKeyExists(siteKey) {
      return sites.some((s) => s.site_key === siteKey);
    },
    async createSite(input) {
      const clash = sites.some(
        (s) =>
          s.site_key === input.site_key ||
          (s.workspace_id === input.workspace_id && s.domain === input.domain),
      );
      if (clash) throw new UniqueViolationError();
      const row: SiteRow = {
        id: input.id ?? randomUUID(),
        workspace_id: input.workspace_id,
        domain: input.domain,
        site_key: input.site_key,
        include_subdomains: input.include_subdomains ?? false,
        paused: input.paused ?? false,
        allow_localhost: input.allow_localhost ?? false,
        first_event_at: input.first_event_at ?? null,
        last_event_at: input.last_event_at ?? null,
        created_at: input.created_at ?? now(),
      };
      sites.push(row);
      return clone(row);
    },
    async updateSite(id, patch) {
      const row = sites.find((s) => s.id === id);
      if (!row) throw new Error('Database returned no row');
      Object.assign(row, patch);
      return clone(row);
    },
    async deleteSite(id) {
      removeWhere(sites, (s) => s.id === id);
    },
  };
}
