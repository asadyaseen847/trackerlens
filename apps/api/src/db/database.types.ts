/**
 * Types for supabase/migrations, in the format `supabase gen types typescript` produces.
 * Hand-written to match 20261013000000_initial_schema.sql. After a schema change, regenerate
 * with `npm run db:types` (or update by hand) and keep docs/database.md in sync.
 */

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

type Device = 'phone' | 'tablet' | 'desktop';

/** Filters shared by the stats_* functions. */
type StatsFilterArgs = {
  p_site_ids: string[];
  p_start: string;
  p_end: string;
  p_channels?: string[] | null;
  p_device?: Device | null;
  p_country?: string | null;
};
type MemberRole = 'owner' | 'member';
type SocialAccountStatus = 'connected' | 'needs_reconnect' | 'disconnected';

/** Builds Insert/Update from Row: `Required` keys stay required on insert. */
type Table<Row, Required extends keyof Row, Rel = []> = {
  Row: Row;
  Insert: Pick<Row, Required> & Partial<Omit<Row, Required>>;
  Update: Partial<Row>;
  Relationships: Rel;
};

type Fk<Name extends string, Col extends string, Ref extends string> = {
  foreignKeyName: Name;
  columns: [Col];
  isOneToOne: false;
  referencedRelation: Ref;
  referencedColumns: ['id'];
};

export type Database = {
  public: {
    Tables: {
      channels: Table<
        { id: string; label: string; description: string; sort_order: number },
        'id' | 'label' | 'description' | 'sort_order'
      >;
      platforms: Table<
        { id: string; label: string; channel_id: string; sort_order: number },
        'id' | 'label' | 'channel_id',
        [Fk<'platforms_channel_id_fkey', 'channel_id', 'channels'>]
      >;
      users: Table<
        {
          id: string;
          email: string;
          password_hash: string;
          name: string;
          created_at: string;
          updated_at: string;
        },
        'email' | 'password_hash' | 'name'
      >;
      workspaces: Table<
        {
          id: string;
          name: string;
          timezone: string;
          retention_months: number;
          created_at: string;
          updated_at: string;
        },
        'name'
      >;
      workspace_members: Table<
        { workspace_id: string; user_id: string; role: MemberRole; created_at: string },
        'workspace_id' | 'user_id' | 'role',
        [
          Fk<'workspace_members_workspace_id_fkey', 'workspace_id', 'workspaces'>,
          Fk<'workspace_members_user_id_fkey', 'user_id', 'users'>,
        ]
      >;
      sites: Table<
        {
          id: string;
          workspace_id: string;
          domain: string;
          site_key: string;
          include_subdomains: boolean;
          paused: boolean;
          allow_localhost: boolean;
          first_event_at: string | null;
          last_event_at: string | null;
          created_at: string;
          updated_at: string;
        },
        'workspace_id' | 'domain' | 'site_key',
        [Fk<'sites_workspace_id_fkey', 'workspace_id', 'workspaces'>]
      >;
      salts: Table<{ day: string; value: string; created_at: string }, 'day' | 'value'>;
      visits: Table<
        {
          id: string;
          site_id: string;
          visitor_hash: string;
          started_at: string;
          last_seen_at: string;
          pageview_count: number;
          entry_path: string;
          exit_path: string;
          channel_id: string;
          platform_id: string;
          source_detail: string | null;
          is_paid: boolean;
          referrer_host: string | null;
          utm_source: string | null;
          utm_medium: string | null;
          utm_campaign: string | null;
          utm_term: string | null;
          utm_content: string | null;
          country_code: string;
          device: Device;
          browser: string | null;
          os: string | null;
        },
        | 'site_id'
        | 'visitor_hash'
        | 'started_at'
        | 'last_seen_at'
        | 'entry_path'
        | 'exit_path'
        | 'channel_id'
        | 'platform_id'
        | 'device',
        [
          Fk<'visits_site_id_fkey', 'site_id', 'sites'>,
          Fk<'visits_channel_id_fkey', 'channel_id', 'channels'>,
          Fk<'visits_platform_id_fkey', 'platform_id', 'platforms'>,
        ]
      >;
      page_views: {
        Row: { id: number; visit_id: string; site_id: string; viewed_at: string; path: string };
        Insert: { id?: never; visit_id: string; site_id: string; viewed_at: string; path: string };
        Update: {
          id?: never;
          visit_id?: string;
          site_id?: string;
          viewed_at?: string;
          path?: string;
        };
        Relationships: [
          Fk<'page_views_visit_id_fkey', 'visit_id', 'visits'>,
          Fk<'page_views_site_id_fkey', 'site_id', 'sites'>,
        ];
      };
      social_accounts: Table<
        {
          id: string;
          workspace_id: string;
          platform_id: string;
          external_id: string;
          handle: string;
          name: string;
          avatar_url: string | null;
          status: SocialAccountStatus;
          last_synced_at: string | null;
          created_at: string;
          updated_at: string;
        },
        'workspace_id' | 'platform_id' | 'external_id' | 'handle' | 'name',
        [
          Fk<'social_accounts_workspace_id_fkey', 'workspace_id', 'workspaces'>,
          Fk<'social_accounts_platform_id_fkey', 'platform_id', 'platforms'>,
        ]
      >;
      social_account_tokens: {
        Row: {
          social_account_id: string;
          access_token_enc: string;
          refresh_token_enc: string | null;
          expires_at: string | null;
          scopes: string[];
          updated_at: string;
        };
        Insert: {
          social_account_id: string;
          access_token_enc: string;
          refresh_token_enc?: string | null;
          expires_at?: string | null;
          scopes?: string[];
          updated_at?: string;
        };
        Update: Partial<Database['public']['Tables']['social_account_tokens']['Row']>;
        Relationships: [
          {
            foreignKeyName: 'social_account_tokens_social_account_id_fkey';
            columns: ['social_account_id'];
            isOneToOne: true;
            referencedRelation: 'social_accounts';
            referencedColumns: ['id'];
          },
        ];
      };
      social_daily_stats: Table<
        {
          social_account_id: string;
          day: string;
          followers: number | null;
          views: number | null;
          engagements: number | null;
          link_clicks: number | null;
        },
        'social_account_id' | 'day',
        [Fk<'social_daily_stats_social_account_id_fkey', 'social_account_id', 'social_accounts'>]
      >;
    };
    Views: { [_ in never]: never };
    /** supabase/migrations/20261014000000_tracking_and_stats.sql */
    Functions: {
      get_or_create_salt: { Args: { p_day: string; p_candidate: string }; Returns: string };
      cleanup_salts: { Args: { p_before: string }; Returns: number };
      record_page_view: {
        Args: {
          p_site_id: string;
          p_visitor_hash: string;
          p_at: string;
          p_path: string;
          p_channel_id: string;
          p_platform_id: string;
          p_source_detail: string | null;
          p_is_paid: boolean;
          p_referrer_host: string | null;
          p_utm_source: string | null;
          p_utm_medium: string | null;
          p_utm_campaign: string | null;
          p_utm_term: string | null;
          p_utm_content: string | null;
          p_country_code: string;
          p_device: Device;
          p_browser: string | null;
          p_os: string | null;
          p_timeout_minutes?: number;
        };
        Returns: Array<{ o_visit_id: string; o_new_visit: boolean }>;
      };
      stats_kpis: {
        Args: StatsFilterArgs;
        Returns: Array<{ visits: number; visitors: number; pageviews: number }>;
      };
      stats_series: {
        Args: StatsFilterArgs & { p_unit: string; p_tz: string };
        Returns: Array<{ bucket: string; channel_id: string; visits: number }>;
      };
      stats_breakdown: {
        Args: StatsFilterArgs & { p_dimension: string; p_limit: number };
        Returns: Array<{
          key: string;
          label: string;
          detail: string | null;
          channel_id: string | null;
          value: number;
        }>;
      };
      stats_live: {
        Args: {
          p_site_ids: string[];
          p_since: string;
          p_channels?: string[] | null;
          p_device?: Device | null;
          p_country?: string | null;
        };
        Returns: number;
      };
      stats_site_daily: {
        Args: { p_site_ids: string[]; p_start: string; p_end: string; p_tz: string };
        Returns: Array<{ site_id: string; day: string; visits: number }>;
      };
      stats_visits_by_platform: {
        Args: {
          p_site_ids: string[];
          p_start: string;
          p_end: string;
          p_tz: string;
          p_unit: string;
        };
        Returns: Array<{ platform_id: string; bucket: string; visits: number }>;
      };
      purge_expired_data: {
        Args: Record<string, never>;
        Returns: Array<{ visits_deleted: number; page_views_deleted: number }>;
      };
    };
    Enums: {
      device: Device;
      member_role: MemberRole;
      social_account_status: SocialAccountStatus;
    };
    CompositeTypes: { [_ in never]: never };
  };
};

export type Tables<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Row'];
export type TablesInsert<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Insert'];
export type TablesUpdate<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Update'];
