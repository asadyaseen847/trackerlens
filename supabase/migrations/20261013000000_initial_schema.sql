-- Initial schema: BUILD_PROMPT §5 data model, translated from MongoDB to Postgres.
-- See docs/decisions.md ("Supabase Postgres instead of MongoDB").
--
-- All timestamps are timestamptz (stored as UTC). Bucket into the workspace timezone only at
-- query time. The API talks to these tables with the service-role key; RLS is enabled with no
-- policies so the public anon key can read or write nothing.

-- ---------- enums ----------

create type public.channel as enum ('social', 'search', 'email', 'ai', 'direct', 'other');
create type public.device as enum ('phone', 'tablet', 'desktop');
create type public.member_role as enum ('owner', 'member');
create type public.social_platform as enum ('instagram', 'facebook', 'youtube', 'linkedin', 'tiktok', 'x');
create type public.social_account_status as enum ('connected', 'needs_reconnect', 'disconnected');

-- ---------- accounts ----------

-- Our own email + password accounts (not Supabase Auth's auth.users).
create table public.users (
  id uuid primary key default gen_random_uuid(),
  email text not null check (email = lower(email)),
  password_hash text not null,
  name text not null,
  created_at timestamptz not null default now()
);
create unique index users_email_key on public.users (email);

create table public.workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  -- IANA timezone, e.g. 'Asia/Karachi'.
  timezone text not null default 'UTC',
  -- Raw data retention, enforced by the Phase 6 retention cron (§5).
  retention_months integer not null default 25 check (retention_months > 0),
  created_at timestamptz not null default now()
);

create table public.workspace_members (
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  user_id uuid not null references public.users (id) on delete cascade,
  role public.member_role not null,
  created_at timestamptz not null default now(),
  primary key (workspace_id, user_id)
);
create index workspace_members_user_id_idx on public.workspace_members (user_id);

-- ---------- sites ----------

create table public.sites (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  -- 'shop.example.com': no protocol, no www.
  domain text not null check (domain = lower(domain)),
  -- Public id used in the snippet, e.g. 'ws_7Q2K9X'.
  site_key text not null,
  include_subdomains boolean not null default false,
  paused boolean not null default false,
  allow_localhost boolean not null default false,
  first_event_at timestamptz,
  last_event_at timestamptz,
  created_at timestamptz not null default now()
);
create unique index sites_site_key_key on public.sites (site_key);
create unique index sites_workspace_id_domain_key on public.sites (workspace_id, domain);

-- ---------- tracking ----------

-- One salt per UTC day; the cleanup-salts cron deletes salts older than 2 days.
create table public.salts (
  day date primary key,
  -- 32 random bytes, hex.
  value text not null,
  created_at timestamptz not null default now()
);

-- One visit: 30 minutes without activity ends it (§9). Never stores the IP or full user agent.
create table public.sessions (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references public.sites (id) on delete cascade,
  visitor_hash text not null,
  started_at timestamptz not null,
  last_seen_at timestamptz not null,
  pageviews integer not null default 1,
  entry_path text not null,
  exit_path text not null,
  channel public.channel not null,
  -- e.g. 'instagram', 'google', or a referrer host.
  platform text not null,
  is_paid boolean not null default false,
  referrer_host text,
  utm_source text,
  utm_medium text,
  utm_campaign text,
  utm_term text,
  utm_content text,
  -- ISO-2 or 'XX'.
  country text not null default 'XX' check (char_length(country) = 2),
  device public.device not null,
  browser text,
  os text
);
create index sessions_site_id_started_at_idx on public.sessions (site_id, started_at);
create index sessions_site_id_visitor_hash_last_seen_at_idx
  on public.sessions (site_id, visitor_hash, last_seen_at desc);
-- "On the site right now".
create index sessions_site_id_last_seen_at_idx on public.sessions (site_id, last_seen_at desc);

-- Replaces the MongoDB time-series collection: append-only, queried by site + time range.
create table public.pageviews (
  id bigint generated always as identity primary key,
  ts timestamptz not null,
  site_id uuid not null references public.sites (id) on delete cascade,
  session_id uuid not null references public.sessions (id) on delete cascade,
  path text not null,
  channel public.channel not null,
  platform text not null,
  country text not null,
  device public.device not null
);
create index pageviews_site_id_ts_idx on public.pageviews (site_id, ts);
create index pageviews_session_id_idx on public.pageviews (session_id);
-- Cheap index for retention deletes by time.
create index pageviews_ts_brin_idx on public.pageviews using brin (ts);

-- ---------- social ----------

create table public.social_accounts (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  platform public.social_platform not null,
  external_id text not null,
  handle text not null,
  name text not null,
  avatar_url text,
  -- Encrypted with AES-256-GCM using ENCRYPTION_KEY (§13).
  access_token_enc text not null,
  refresh_token_enc text,
  token_expires_at timestamptz,
  scopes text[] not null default '{}',
  status public.social_account_status not null default 'connected',
  last_synced_at timestamptz,
  created_at timestamptz not null default now()
);
create unique index social_accounts_workspace_platform_external_key
  on public.social_accounts (workspace_id, platform, external_id);

create table public.social_daily_stats (
  social_account_id uuid not null references public.social_accounts (id) on delete cascade,
  day date not null,
  followers integer,
  views bigint,
  engagements bigint,
  link_clicks bigint,
  primary key (social_account_id, day)
);

-- ---------- row level security ----------
-- Enabled everywhere with no policies: only the service role (used by apps/api) can access.

alter table public.users enable row level security;
alter table public.workspaces enable row level security;
alter table public.workspace_members enable row level security;
alter table public.sites enable row level security;
alter table public.salts enable row level security;
alter table public.sessions enable row level security;
alter table public.pageviews enable row level security;
alter table public.social_accounts enable row level security;
alter table public.social_daily_stats enable row level security;
