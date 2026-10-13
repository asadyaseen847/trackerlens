import type { Tables, TablesInsert, TablesUpdate } from './database.types.js';

export type UserRow = Tables<'users'>;
export type WorkspaceRow = Tables<'workspaces'>;
export type MemberRow = Tables<'workspace_members'>;
export type SiteRow = Tables<'sites'>;

/** A unique constraint was hit (duplicate email, domain or site key). */
export class UniqueViolationError extends Error {
  constructor(message = 'Unique constraint violated') {
    super(message);
    this.name = 'UniqueViolationError';
  }
}

/**
 * Everything the API reads or writes. Production uses supabaseRepo(); tests use an in-memory
 * implementation (test/memoryRepo.ts). Workspace scoping is the caller's job: services always
 * check a row's workspace_id against the signed-in user's workspace.
 */
export interface Repo {
  /** Cheap round trip to the database; throws when it can't be reached. */
  ping(): Promise<void>;

  findUserByEmail(email: string): Promise<UserRow | null>;
  findUserById(id: string): Promise<UserRow | null>;
  /** Throws UniqueViolationError when the email is taken. */
  createUser(input: TablesInsert<'users'>): Promise<UserRow>;
  deleteUser(id: string): Promise<void>;

  createWorkspace(input: TablesInsert<'workspaces'>): Promise<WorkspaceRow>;
  findWorkspaceById(id: string): Promise<WorkspaceRow | null>;
  updateWorkspace(id: string, patch: TablesUpdate<'workspaces'>): Promise<WorkspaceRow>;
  deleteWorkspace(id: string): Promise<void>;

  addMember(input: TablesInsert<'workspace_members'>): Promise<void>;
  /** The user's first (oldest) membership. One workspace per user until team invites exist. */
  findMembershipForUser(userId: string): Promise<MemberRow | null>;

  listSites(workspaceId: string): Promise<SiteRow[]>;
  findSiteById(id: string): Promise<SiteRow | null>;
  findSiteByDomain(workspaceId: string, domain: string): Promise<SiteRow | null>;
  siteKeyExists(siteKey: string): Promise<boolean>;
  /** Throws UniqueViolationError on a duplicate domain (in the workspace) or site key. */
  createSite(input: TablesInsert<'sites'>): Promise<SiteRow>;
  updateSite(id: string, patch: TablesUpdate<'sites'>): Promise<SiteRow>;
  /** Also deletes the site's visits and page views (ON DELETE CASCADE). */
  deleteSite(id: string): Promise<void>;
}
