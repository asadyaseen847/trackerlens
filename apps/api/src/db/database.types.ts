/**
 * Types for supabase/migrations, in the format `supabase gen types typescript` produces.
 * Hand-written for the scaffold. Once the Supabase project exists, regenerate with
 * `npm run db:types` and keep this file in sync with every new migration.
 */

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

type Channel = 'social' | 'search' | 'email' | 'ai' | 'direct' | 'other';
type Device = 'phone' | 'tablet' | 'desktop';
type MemberRole = 'owner' | 'member';
type SocialPlatform = 'instagram' | 'facebook' | 'youtube' | 'linkedin' | 'tiktok' | 'x';
type SocialAccountStatus = 'connected' | 'needs_reconnect' | 'disconnected';

export type Database = {
  public: {
    Tables: {
      users: {
        Row: {
          id: string;
          email: string;
          password_hash: string;
          name: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          email: string;
          password_hash: string;
          name: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          email?: string;
          password_hash?: string;
          name?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      workspaces: {
        Row: {
          id: string;
          name: string;
          timezone: string;
          retention_months: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          timezone?: string;
          retention_months?: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          timezone?: string;
          retention_months?: number;
          created_at?: string;
        };
        Relationships: [];
      };
      workspace_members: {
        Row: {
          workspace_id: string;
          user_id: string;
          role: MemberRole;
          created_at: string;
        };
        Insert: {
          workspace_id: string;
          user_id: string;
          role: MemberRole;
          created_at?: string;
        };
        Update: {
          workspace_id?: string;
          user_id?: string;
          role?: MemberRole;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'workspace_members_workspace_id_fkey';
            columns: ['workspace_id'];
            isOneToOne: false;
            referencedRelation: 'workspaces';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'workspace_members_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
        ];
      };
      sites: {
        Row: {
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
        };
        Insert: {
          id?: string;
          workspace_id: string;
          domain: string;
          site_key: string;
          include_subdomains?: boolean;
          paused?: boolean;
          allow_localhost?: boolean;
          first_event_at?: string | null;
          last_event_at?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          workspace_id?: string;
          domain?: string;
          site_key?: string;
          include_subdomains?: boolean;
          paused?: boolean;
          allow_localhost?: boolean;
          first_event_at?: string | null;
          last_event_at?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'sites_workspace_id_fkey';
            columns: ['workspace_id'];
            isOneToOne: false;
            referencedRelation: 'workspaces';
            referencedColumns: ['id'];
          },
        ];
      };
      salts: {
        Row: {
          day: string;
          value: string;
          created_at: string;
        };
        Insert: {
          day: string;
          value: string;
          created_at?: string;
        };
        Update: {
          day?: string;
          value?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      sessions: {
        Row: {
          id: string;
          site_id: string;
          visitor_hash: string;
          started_at: string;
          last_seen_at: string;
          pageviews: number;
          entry_path: string;
          exit_path: string;
          channel: Channel;
          platform: string;
          is_paid: boolean;
          referrer_host: string | null;
          utm_source: string | null;
          utm_medium: string | null;
          utm_campaign: string | null;
          utm_term: string | null;
          utm_content: string | null;
          country: string;
          device: Device;
          browser: string | null;
          os: string | null;
        };
        Insert: {
          id?: string;
          site_id: string;
          visitor_hash: string;
          started_at: string;
          last_seen_at: string;
          pageviews?: number;
          entry_path: string;
          exit_path: string;
          channel: Channel;
          platform: string;
          is_paid?: boolean;
          referrer_host?: string | null;
          utm_source?: string | null;
          utm_medium?: string | null;
          utm_campaign?: string | null;
          utm_term?: string | null;
          utm_content?: string | null;
          country?: string;
          device: Device;
          browser?: string | null;
          os?: string | null;
        };
        Update: {
          id?: string;
          site_id?: string;
          visitor_hash?: string;
          started_at?: string;
          last_seen_at?: string;
          pageviews?: number;
          entry_path?: string;
          exit_path?: string;
          channel?: Channel;
          platform?: string;
          is_paid?: boolean;
          referrer_host?: string | null;
          utm_source?: string | null;
          utm_medium?: string | null;
          utm_campaign?: string | null;
          utm_term?: string | null;
          utm_content?: string | null;
          country?: string;
          device?: Device;
          browser?: string | null;
          os?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'sessions_site_id_fkey';
            columns: ['site_id'];
            isOneToOne: false;
            referencedRelation: 'sites';
            referencedColumns: ['id'];
          },
        ];
      };
      pageviews: {
        Row: {
          id: number;
          ts: string;
          site_id: string;
          session_id: string;
          path: string;
          channel: Channel;
          platform: string;
          country: string;
          device: Device;
        };
        Insert: {
          id?: never;
          ts: string;
          site_id: string;
          session_id: string;
          path: string;
          channel: Channel;
          platform: string;
          country: string;
          device: Device;
        };
        Update: {
          id?: never;
          ts?: string;
          site_id?: string;
          session_id?: string;
          path?: string;
          channel?: Channel;
          platform?: string;
          country?: string;
          device?: Device;
        };
        Relationships: [
          {
            foreignKeyName: 'pageviews_site_id_fkey';
            columns: ['site_id'];
            isOneToOne: false;
            referencedRelation: 'sites';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'pageviews_session_id_fkey';
            columns: ['session_id'];
            isOneToOne: false;
            referencedRelation: 'sessions';
            referencedColumns: ['id'];
          },
        ];
      };
      social_accounts: {
        Row: {
          id: string;
          workspace_id: string;
          platform: SocialPlatform;
          external_id: string;
          handle: string;
          name: string;
          avatar_url: string | null;
          access_token_enc: string;
          refresh_token_enc: string | null;
          token_expires_at: string | null;
          scopes: string[];
          status: SocialAccountStatus;
          last_synced_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          workspace_id: string;
          platform: SocialPlatform;
          external_id: string;
          handle: string;
          name: string;
          avatar_url?: string | null;
          access_token_enc: string;
          refresh_token_enc?: string | null;
          token_expires_at?: string | null;
          scopes?: string[];
          status?: SocialAccountStatus;
          last_synced_at?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          workspace_id?: string;
          platform?: SocialPlatform;
          external_id?: string;
          handle?: string;
          name?: string;
          avatar_url?: string | null;
          access_token_enc?: string;
          refresh_token_enc?: string | null;
          token_expires_at?: string | null;
          scopes?: string[];
          status?: SocialAccountStatus;
          last_synced_at?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'social_accounts_workspace_id_fkey';
            columns: ['workspace_id'];
            isOneToOne: false;
            referencedRelation: 'workspaces';
            referencedColumns: ['id'];
          },
        ];
      };
      social_daily_stats: {
        Row: {
          social_account_id: string;
          day: string;
          followers: number | null;
          views: number | null;
          engagements: number | null;
          link_clicks: number | null;
        };
        Insert: {
          social_account_id: string;
          day: string;
          followers?: number | null;
          views?: number | null;
          engagements?: number | null;
          link_clicks?: number | null;
        };
        Update: {
          social_account_id?: string;
          day?: string;
          followers?: number | null;
          views?: number | null;
          engagements?: number | null;
          link_clicks?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: 'social_daily_stats_social_account_id_fkey';
            columns: ['social_account_id'];
            isOneToOne: false;
            referencedRelation: 'social_accounts';
            referencedColumns: ['id'];
          },
        ];
      };
    };
    Views: { [_ in never]: never };
    // TODO(Phase 3, §9): stats aggregation functions (called with db.rpc).
    Functions: { [_ in never]: never };
    Enums: {
      channel: Channel;
      device: Device;
      member_role: MemberRole;
      social_platform: SocialPlatform;
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
