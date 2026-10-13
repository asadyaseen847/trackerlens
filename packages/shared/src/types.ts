/** Where a visit came from, at the broadest level (BUILD_PROMPT §5, §8). */
export type Channel = 'social' | 'search' | 'email' | 'ai' | 'direct' | 'other';

/** Social platforms the customer can connect (BUILD_PROMPT §13). */
export type SocialPlatform = 'instagram' | 'facebook' | 'youtube' | 'linkedin' | 'tiktok' | 'x';

/** Dashboard grouping (BUILD_PROMPT §9). */
export type Period = 'daily' | 'weekly' | 'monthly' | 'yearly';

export type Device = 'phone' | 'tablet' | 'desktop';

export type SiteStatus = 'waiting' | 'live' | 'paused';

export type BreakdownDimension = 'platform' | 'page' | 'campaign' | 'country' | 'device';

export interface Utm {
  source?: string;
  medium?: string;
  campaign?: string;
  term?: string;
  content?: string;
}

export interface DateRange {
  /** ISO timestamp, inclusive. */
  start: string;
  /** ISO timestamp, exclusive. */
  end: string;
}

export interface Kpi {
  value: number;
  previous: number;
  /** null when there is nothing to compare with. */
  changePct: number | null;
}

export interface SeriesBucket {
  /** ISO timestamp of the bucket start. */
  start: string;
  /** Short axis label, e.g. "Mon 6". */
  label: string;
  /** Long label for tooltips, e.g. "Monday, 6 October 2026". */
  fullLabel: string;
  /** True for the current, still-running bucket (drawn striped). */
  partial: boolean;
  byChannel: Record<Channel, number>;
}

export interface BreakdownRow {
  key: string;
  label: string;
  /** Extra context: the domain for pages, the platform for campaigns. */
  detail?: string;
  channel?: Channel;
  value: number;
  /** 0–1 share of the total. */
  share: number;
  previous: number;
  changePct: number | null;
}

/* ---------- API: auth & workspace (§10) ---------- */

export interface UserDto {
  id: string;
  email: string;
  name: string;
}

export interface WorkspaceDto {
  id: string;
  name: string;
  timezone: string;
  role: 'owner' | 'member';
}

export interface MeResponse {
  user: UserDto;
  workspace: WorkspaceDto;
}

/* ---------- API: sites (§10) ---------- */

export interface SiteSettings {
  includeSubdomains: boolean;
  paused: boolean;
  allowLocalhost: boolean;
}

export interface SiteDto {
  id: string;
  domain: string;
  siteKey: string;
  settings: SiteSettings;
  status: SiteStatus;
  firstEventAt: string | null;
  lastEventAt: string | null;
  createdAt: string;
}

export interface SiteListItem extends SiteDto {
  visits30d: number;
  /** 14 daily visit counts, oldest first. */
  sparkline: number[];
}

export interface SitesResponse {
  sites: SiteListItem[];
}

export interface SnippetResponse {
  html: string;
}

export interface SiteStatusResponse {
  installed: boolean;
  lastEventAt: string | null;
}

/* ---------- API: stats (§10) ---------- */

export interface StatsFilters {
  /** 'all' or a site id. */
  site: string;
  period: Period;
  channels?: Channel[];
  device?: Device;
  country?: string;
}

export interface OverviewResponse {
  range: DateRange;
  compareRange: DateRange;
  /** "Sep 15 – Oct 14, 2026" */
  rangeLabel: string;
  /** "Aug 16 – Sep 14" or "the same dates last year" */
  compareLabel: string;
  /** Bucket unit for titles: "Visits per day". */
  unit: 'day' | 'week' | 'month' | 'year';
  /** False when the selected sites have never received a visit. */
  hasData: boolean;
  kpis: { visits: Kpi; visitors: Kpi; pageviews: Kpi };
  series: SeriesBucket[];
}

export interface BreakdownResponse {
  rows: BreakdownRow[];
}

export interface LiveResponse {
  count: number;
}

/* ---------- API: social (§10, §13) ---------- */

export type SocialAccountStatus = 'connected' | 'needs_reconnect' | 'disconnected';

export interface SocialAccountDto {
  id: string;
  platform: SocialPlatform;
  handle: string;
  name: string;
  avatarUrl?: string;
  status: SocialAccountStatus;
  lastSyncedAt: string | null;
}

export interface SocialAccountsResponse {
  accounts: SocialAccountDto[];
  /** True when the mock provider is on: the UI labels everything "Sample data". */
  sampleData: boolean;
}

export interface SocialPlatformSummary {
  platform: SocialPlatform;
  account: SocialAccountDto | null;
  /** Followers at the end of the range (null if not connected or not reported). */
  followers: number | null;
  /** Followers gained in the range (can be negative). */
  newFollowers: number;
  views: number;
  /** engagements / views, in percent. */
  engagementRate: number | null;
  /** Website visits whose platform is this network. */
  visits: number;
  visitsPer1000Views: number | null;
}

export interface SocialOverviewResponse {
  rangeLabel: string;
  compareLabel: string;
  unit: 'day' | 'week' | 'month' | 'year';
  sampleData: boolean;
  totals: { followers: Kpi; newFollowers: Kpi; views: Kpi; visits: Kpi };
  /** One entry per platform, connected or not, in SOCIAL_PLATFORMS order. */
  platforms: SocialPlatformSummary[];
  /** Post views per bucket and connected platform. */
  series: Array<{
    start: string;
    label: string;
    fullLabel: string;
    partial: boolean;
    byPlatform: Partial<Record<SocialPlatform, number>>;
  }>;
  /** Connected platforms, best visits-per-1,000-views first. */
  viewsToVisits: Array<{
    platform: SocialPlatform;
    views: number;
    visits: number;
    visitsPer1000Views: number;
    newFollowers: number;
  }>;
}

/* ---------- API: errors ---------- */

export interface ApiErrorBody {
  error: string;
  phase?: number;
  details?: unknown;
}
