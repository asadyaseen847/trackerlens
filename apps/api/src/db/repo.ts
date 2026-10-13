import type { Device } from '@audience/shared';
import type { Tables, TablesInsert, TablesUpdate } from './database.types.js';

export type UserRow = Tables<'users'>;
export type WorkspaceRow = Tables<'workspaces'>;
export type MemberRow = Tables<'workspace_members'>;
export type SiteRow = Tables<'sites'>;
export type SocialAccountRow = Tables<'social_accounts'>;
export type SocialTokensRow = Tables<'social_account_tokens'>;
export type SocialDailyStatRow = Tables<'social_daily_stats'>;

/** A unique constraint was hit (duplicate email, domain or site key). */
export class UniqueViolationError extends Error {
  constructor(message = 'Unique constraint violated') {
    super(message);
    this.name = 'UniqueViolationError';
  }
}

export interface RecordPageViewInput {
  siteId: string;
  visitorHash: string;
  at: string;
  path: string;
  channelId: string;
  platformId: string;
  sourceDetail: string | null;
  isPaid: boolean;
  referrerHost: string | null;
  utm: { source?: string; medium?: string; campaign?: string; term?: string; content?: string };
  countryCode: string;
  device: Device;
  browser: string | null;
  os: string | null;
}

/** Filters shared by every stats query (§9). Sites are already scoped to the workspace. */
export interface StatsQuery {
  siteIds: string[];
  /** ISO instant, inclusive. */
  start: string;
  /** ISO instant, exclusive. */
  end: string;
  channels: string[] | null;
  device: Device | null;
  country: string | null;
}

export interface BreakdownDbRow {
  key: string;
  label: string;
  detail: string | null;
  channelId: string | null;
  value: number;
}

/**
 * Everything the API reads or writes. Production uses supabaseRepo(); tests and the e2e server
 * use pgliteRepo() (real Postgres in memory, same migrations). Workspace scoping is the
 * caller's job: services always check a row's workspace_id against the signed-in workspace.
 */
export interface Repo {
  /** Cheap round trip to the database; throws when it can't be reached. */
  ping(): Promise<void>;

  /* ---------- accounts ---------- */
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

  /* ---------- sites ---------- */
  listSites(workspaceId: string): Promise<SiteRow[]>;
  findSiteById(id: string): Promise<SiteRow | null>;
  findSiteByKey(siteKey: string): Promise<SiteRow | null>;
  findSiteByDomain(workspaceId: string, domain: string): Promise<SiteRow | null>;
  siteKeyExists(siteKey: string): Promise<boolean>;
  /** Throws UniqueViolationError on a duplicate domain (in the workspace) or site key. */
  createSite(input: TablesInsert<'sites'>): Promise<SiteRow>;
  updateSite(id: string, patch: TablesUpdate<'sites'>): Promise<SiteRow>;
  /** Also deletes the site's visits and page views (ON DELETE CASCADE). */
  deleteSite(id: string): Promise<void>;

  /* ---------- tracking (Phase 2) ---------- */
  getOrCreateSalt(day: string, candidate: string): Promise<string>;
  cleanupSalts(beforeDay: string): Promise<number>;
  recordPageView(input: RecordPageViewInput): Promise<{ visitId: string; newVisit: boolean }>;

  /* ---------- stats (Phase 3) ---------- */
  statsKpis(q: StatsQuery): Promise<{ visits: number; visitors: number; pageviews: number }>;
  statsSeries(
    q: StatsQuery,
    unit: string,
    timezone: string,
  ): Promise<Array<{ bucket: string; channelId: string; visits: number }>>;
  statsBreakdown(q: StatsQuery, dimension: string, limit: number): Promise<BreakdownDbRow[]>;
  statsLive(q: Omit<StatsQuery, 'start' | 'end'>, since: string): Promise<number>;
  statsSiteDaily(
    siteIds: string[],
    start: string,
    end: string,
    timezone: string,
  ): Promise<Array<{ siteId: string; day: string; visits: number }>>;
  statsVisitsByPlatform(
    siteIds: string[],
    start: string,
    end: string,
    timezone: string,
    unit: string,
  ): Promise<Array<{ platformId: string; bucket: string; visits: number }>>;

  /* ---------- social (Phase 4) ---------- */
  listSocialAccounts(workspaceId: string): Promise<SocialAccountRow[]>;
  /** Accounts the daily sync should fetch (status connected), across all workspaces. */
  listSocialAccountsToSync(): Promise<SocialAccountRow[]>;
  findSocialAccountById(id: string): Promise<SocialAccountRow | null>;
  /** Insert, or update the existing row for (workspace, platform, external id). */
  upsertSocialAccount(input: TablesInsert<'social_accounts'>): Promise<SocialAccountRow>;
  updateSocialAccount(
    id: string,
    patch: TablesUpdate<'social_accounts'>,
  ): Promise<SocialAccountRow>;
  deleteSocialAccount(id: string): Promise<void>;
  saveSocialTokens(input: TablesInsert<'social_account_tokens'>): Promise<void>;
  getSocialTokens(socialAccountId: string): Promise<SocialTokensRow | null>;
  upsertSocialDailyStats(rows: TablesInsert<'social_daily_stats'>[]): Promise<void>;
  listSocialDailyStats(
    accountIds: string[],
    fromDay: string,
    toDay: string,
  ): Promise<SocialDailyStatRow[]>;

  /* ---------- retention (Phase 6) ---------- */
  purgeExpiredData(): Promise<{ visitsDeleted: number; pageViewsDeleted: number }>;
}

/** Arguments shared by the stats_* SQL functions. */
export function statsArgs(q: Omit<StatsQuery, 'start' | 'end'>) {
  return {
    p_site_ids: q.siteIds,
    p_channels: q.channels,
    p_device: q.device,
    p_country: q.country,
  };
}

/** Arguments for record_page_view. */
export function recordPageViewArgs(i: RecordPageViewInput) {
  return {
    p_site_id: i.siteId,
    p_visitor_hash: i.visitorHash,
    p_at: i.at,
    p_path: i.path,
    p_channel_id: i.channelId,
    p_platform_id: i.platformId,
    p_source_detail: i.sourceDetail,
    p_is_paid: i.isPaid,
    p_referrer_host: i.referrerHost,
    p_utm_source: i.utm.source ?? null,
    p_utm_medium: i.utm.medium ?? null,
    p_utm_campaign: i.utm.campaign ?? null,
    p_utm_term: i.utm.term ?? null,
    p_utm_content: i.utm.content ?? null,
    p_country_code: i.countryCode,
    p_device: i.device,
    p_browser: i.browser,
    p_os: i.os,
  };
}
