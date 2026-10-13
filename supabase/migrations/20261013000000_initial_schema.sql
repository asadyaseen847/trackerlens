-- =====================================================================================
-- TrackerLens: database schema (Supabase Postgres)
--
-- Design (see docs/database.md for the diagram and the reasons):
--   * Third normal form: every fact is stored once. Page views point to their visit and
--     read the visit's source, device and country from it.
--   * Lookup tables for the fixed vocabularies people read (channels, platforms), so a row
--     like platform 'instagram' explains itself in the Table Editor.
--   * Plain names that match the app: a "visit" has "page views".
--   * Secrets (OAuth tokens) live in their own table, apart from profile data.
--   * Integrity rules live in the database: foreign keys, checks, unique keys, cascades.
--   * Security: row level security on every table with no policies, and no grants to
--     Supabase's anon/authenticated roles. Only the API (service role) can read or write.
--
-- All timestamps are timestamptz (stored in UTC). Bucket into a workspace's timezone only
-- at query time.
-- =====================================================================================


-- -------------------------------------------------------------------------------------
-- Shared helpers
-- -------------------------------------------------------------------------------------

create function public.set_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;
comment on function public.set_updated_at() is
  'Trigger: keeps updated_at current on every UPDATE.';

create type public.device as enum ('phone', 'tablet', 'desktop');
comment on type public.device is
  'Screen class from the visitor''s window width: under 768 px phone, under 1024 px tablet, else desktop.';

create type public.member_role as enum ('owner', 'member');
comment on type public.member_role is
  'owner can remove websites and manage the workspace; member can view and add.';

create type public.social_account_status as enum ('connected', 'needs_reconnect', 'disconnected');
comment on type public.social_account_status is
  'needs_reconnect: the platform refused our token and the customer must log in again.';


-- -------------------------------------------------------------------------------------
-- Lookup tables (fixed vocabularies, seeded below)
-- -------------------------------------------------------------------------------------

create table public.channels (
  id          text primary key,
  label       text not null,
  description text not null,
  sort_order  smallint not null unique
);
comment on table public.channels is
  'The broad kind of source a visit came from. Fixed list; order and colors match the dashboard.';
comment on column public.channels.id is 'Stable key used in code, e.g. social, search.';
comment on column public.channels.label is 'Name shown to customers.';
comment on column public.channels.sort_order is 'Display and chart stacking order (BUILD_PROMPT §12).';

create table public.platforms (
  id         text primary key,
  label      text not null,
  channel_id text not null references public.channels (id),
  sort_order smallint not null default 100
);
comment on table public.platforms is
  'Known sources of visits (Google, Instagram, ChatGPT, ...) and the channel each belongs to. '
  'Unknown websites and campaign sources use the platform "other" with the detail on the visit.';
comment on column public.platforms.channel_id is
  'Channel this platform normally belongs to. A visit stores its own channel because a '
  'campaign tag can override it (e.g. a newsletter link).';
create index platforms_channel_id_idx on public.platforms (channel_id);


-- -------------------------------------------------------------------------------------
-- Accounts
-- -------------------------------------------------------------------------------------

create table public.users (
  id            uuid primary key default gen_random_uuid(),
  email         text not null unique check (email = lower(email) and position('@' in email) > 1),
  password_hash text not null,
  name          text not null check (char_length(name) between 1 and 80),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
comment on table public.users is
  'People who log in to the dashboard. Our own email + password accounts, not Supabase Auth.';
comment on column public.users.email is 'Login email, always lowercase.';
comment on column public.users.password_hash is 'bcrypt hash (cost 12). The password itself is never stored.';
create trigger users_set_updated_at before update on public.users
  for each row execute function public.set_updated_at();

create table public.workspaces (
  id               uuid primary key default gen_random_uuid(),
  name             text not null check (char_length(name) between 1 and 80),
  timezone         text not null default 'UTC',
  retention_months smallint not null default 25 check (retention_months between 1 and 120),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
comment on table public.workspaces is
  'A customer account (usually one company). Owns websites and social accounts.';
comment on column public.workspaces.timezone is
  'IANA timezone, e.g. Asia/Karachi. Daily, weekly and monthly numbers are bucketed in it.';
comment on column public.workspaces.retention_months is
  'Raw visits and page views older than this are deleted by the retention cron (Phase 6).';
create trigger workspaces_set_updated_at before update on public.workspaces
  for each row execute function public.set_updated_at();

create table public.workspace_members (
  workspace_id uuid not null references public.workspaces (id) on delete cascade,
  user_id      uuid not null references public.users (id) on delete cascade,
  role         public.member_role not null,
  created_at   timestamptz not null default now(),
  primary key (workspace_id, user_id)
);
comment on table public.workspace_members is
  'Which users belong to which workspace, and their role (many-to-many).';
create index workspace_members_user_id_idx on public.workspace_members (user_id);


-- -------------------------------------------------------------------------------------
-- Websites
-- -------------------------------------------------------------------------------------

create table public.sites (
  id                 uuid primary key default gen_random_uuid(),
  workspace_id       uuid not null references public.workspaces (id) on delete cascade,
  domain             text not null
                     check (domain ~ '^([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$'),
  site_key           text not null unique check (site_key ~ '^ws_[A-HJ-NP-Z2-9]{6}$'),
  include_subdomains boolean not null default false,
  paused             boolean not null default false,
  allow_localhost    boolean not null default false,
  first_event_at     timestamptz,
  last_event_at      timestamptz,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  unique (workspace_id, domain)
);
comment on table public.sites is 'A website being tracked. Each has its own one-line tracking code.';
comment on column public.sites.domain is 'Bare hostname: no protocol, path or "www.", lowercase.';
comment on column public.sites.site_key is
  'Public id in the snippet (data-site="ws_7Q2K9X"). Not secret; the hostname check stops misuse.';
comment on column public.sites.include_subdomains is 'Also count blog.<domain>, shop.<domain>, ...';
comment on column public.sites.paused is 'Hits are dropped while true; the code can stay on the site.';
comment on column public.sites.allow_localhost is 'Count hits from localhost (for testing).';
comment on column public.sites.first_event_at is 'First hit ever received. Null means "waiting for the first visit".';
comment on column public.sites.last_event_at is 'Most recent hit (updated at most once a minute).';
create trigger sites_set_updated_at before update on public.sites
  for each row execute function public.set_updated_at();


-- -------------------------------------------------------------------------------------
-- Tracking
-- -------------------------------------------------------------------------------------

create table public.salts (
  day        date primary key,
  value      text not null check (value ~ '^[0-9a-f]{64}$'),
  created_at timestamptz not null default now()
);
comment on table public.salts is
  'One random salt per UTC day for the visitor hash. Deleted after 2 days, so hashes can''t be '
  'linked across days and can never be reversed to an IP address.';

create table public.visits (
  id            uuid primary key default gen_random_uuid(),
  site_id       uuid not null references public.sites (id) on delete cascade,
  visitor_hash  text not null check (visitor_hash ~ '^[0-9a-f]{16}$'),
  started_at    timestamptz not null,
  last_seen_at  timestamptz not null,
  pageview_count integer not null default 1 check (pageview_count >= 1),
  entry_path    text not null,
  exit_path     text not null,
  channel_id    text not null references public.channels (id),
  platform_id   text not null references public.platforms (id),
  source_detail text,
  is_paid       boolean not null default false,
  referrer_host text,
  utm_source    text,
  utm_medium    text,
  utm_campaign  text,
  utm_term      text,
  utm_content   text,
  country_code  char(2) not null default 'XX' check (country_code ~ '^[A-Z]{2}$'),
  device        public.device not null,
  browser       text,
  os            text,
  check (last_seen_at >= started_at)
);
comment on table public.visits is
  'One visit to a website: page views from the same visitor with no gap over 30 minutes. '
  'Where the visit came from is decided by its first page view. Never stores an IP address '
  'or a full user agent.';
comment on column public.visits.visitor_hash is
  'sha256(daily salt + site + IP + user agent), first 16 hex chars. Changes every day by design.';
comment on column public.visits.pageview_count is 'Pages viewed in this visit (kept in step with page_views).';
comment on column public.visits.channel_id is 'Kind of source, e.g. social. Usually the platform''s channel; campaign tags can override it.';
comment on column public.visits.platform_id is 'Known source, or "other" / "direct".';
comment on column public.visits.source_detail is
  'For platform "other": the referring website''s host or the raw utm_source. Shown in place of the platform name.';
comment on column public.visits.is_paid is 'utm_medium was a paid medium (cpc, paid_social, display, ...).';
comment on column public.visits.referrer_host is 'Host of document.referrer on the first page view, if any.';
comment on column public.visits.country_code is 'ISO 3166-1 alpha-2 from Vercel''s x-vercel-ip-country; XX when unknown.';
comment on column public.visits.browser is 'Browser name only (e.g. Chrome), parsed from the user agent.';
comment on column public.visits.os is 'Operating system name only (e.g. Android).';
-- Covering index: stats read every column they need from the index (index-only scans).
create index visits_site_started_idx on public.visits (site_id, started_at)
  include (visitor_hash, channel_id, platform_id, source_detail, device, country_code, utm_campaign);
create index visits_site_visitor_last_seen_idx on public.visits (site_id, visitor_hash, last_seen_at desc);
create index visits_site_last_seen_idx on public.visits (site_id, last_seen_at desc);
create index visits_platform_id_idx on public.visits (platform_id);
create index visits_channel_id_idx on public.visits (channel_id);

create table public.page_views (
  id        bigint generated always as identity primary key,
  visit_id  uuid not null references public.visits (id) on delete cascade,
  site_id   uuid not null references public.sites (id) on delete cascade,
  viewed_at timestamptz not null,
  path      text not null check (left(path, 1) = '/')
);
comment on table public.page_views is
  'Every page view. Source, device and country come from the visit (join on visit_id). '
  'site_id is kept because every query scans one site''s time range.';
comment on column public.page_views.path is 'Page path without the domain, query string or #hash.';
create index page_views_site_viewed_idx on public.page_views (site_id, viewed_at) include (path, visit_id);
create index page_views_visit_id_idx on public.page_views (visit_id);
create index page_views_viewed_brin_idx on public.page_views using brin (viewed_at);


-- -------------------------------------------------------------------------------------
-- Social media
-- -------------------------------------------------------------------------------------

create table public.social_accounts (
  id             uuid primary key default gen_random_uuid(),
  workspace_id   uuid not null references public.workspaces (id) on delete cascade,
  platform_id    text not null references public.platforms (id),
  external_id    text not null,
  handle         text not null,
  name           text not null,
  avatar_url     text,
  status         public.social_account_status not null default 'connected',
  last_synced_at timestamptz,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique (workspace_id, platform_id, external_id),
  check (platform_id in ('instagram', 'facebook', 'youtube', 'linkedin', 'tiktok', 'x'))
);
comment on table public.social_accounts is 'A social profile or page the customer connected.';
comment on column public.social_accounts.platform_id is 'Which network: one of the six connectable social platforms.';
comment on column public.social_accounts.external_id is 'The account''s id on the platform.';
comment on column public.social_accounts.last_synced_at is 'Last successful daily sync.';
create trigger social_accounts_set_updated_at before update on public.social_accounts
  for each row execute function public.set_updated_at();

create table public.social_account_tokens (
  social_account_id uuid primary key references public.social_accounts (id) on delete cascade,
  access_token_enc  text not null,
  refresh_token_enc text,
  expires_at        timestamptz,
  scopes            text[] not null default '{}',
  updated_at        timestamptz not null default now()
);
comment on table public.social_account_tokens is
  'OAuth tokens for a social account, kept apart from profile data. Encrypted with AES-256-GCM '
  'using ENCRYPTION_KEY before they reach the database.';
create trigger social_account_tokens_set_updated_at before update on public.social_account_tokens
  for each row execute function public.set_updated_at();

create table public.social_daily_stats (
  social_account_id uuid not null references public.social_accounts (id) on delete cascade,
  day               date not null,
  followers         integer check (followers >= 0),
  views             bigint check (views >= 0),
  engagements       bigint check (engagements >= 0),
  link_clicks       bigint check (link_clicks >= 0),
  primary key (social_account_id, day)
);
comment on table public.social_daily_stats is
  'One row per social account per day, as reported by the platform. Null = not reported.';


-- -------------------------------------------------------------------------------------
-- Seed the lookup tables
-- -------------------------------------------------------------------------------------

insert into public.channels (id, label, description, sort_order) values
  ('social', 'Social media',     'Social networks and messaging apps',          1),
  ('search', 'Search',           'Search engines',                              2),
  ('email',  'Email',            'Email apps and newsletters',                  3),
  ('ai',     'AI assistants',    'AI chat assistants such as ChatGPT',          4),
  ('direct', 'Direct',           'Typed in, bookmarked, or no referrer',        5),
  ('other',  'Other websites',   'Any other website, or an unknown campaign',   6);

insert into public.platforms (id, label, channel_id, sort_order) values
  ('google',     'Google',                 'search', 10),
  ('bing',       'Bing',                   'search', 11),
  ('duckduckgo', 'DuckDuckGo',             'search', 12),
  ('yahoo',      'Yahoo',                  'search', 13),
  ('yandex',     'Yandex',                 'search', 14),
  ('baidu',      'Baidu',                  'search', 15),
  ('ecosia',     'Ecosia',                 'search', 16),
  ('brave',      'Brave Search',           'search', 17),
  ('instagram',  'Instagram',              'social', 20),
  ('facebook',   'Facebook',               'social', 21),
  ('youtube',    'YouTube',                'social', 22),
  ('linkedin',   'LinkedIn',               'social', 23),
  ('tiktok',     'TikTok',                 'social', 24),
  ('x',          'X / Twitter',            'social', 25),
  ('reddit',     'Reddit',                 'social', 26),
  ('pinterest',  'Pinterest',              'social', 27),
  ('threads',    'Threads',                'social', 28),
  ('snapchat',   'Snapchat',               'social', 29),
  ('quora',      'Quora',                  'social', 30),
  ('telegram',   'Telegram',               'social', 31),
  ('whatsapp',   'WhatsApp',               'social', 32),
  ('chatgpt',    'ChatGPT',                'ai',     40),
  ('perplexity', 'Perplexity',             'ai',     41),
  ('gemini',     'Gemini',                 'ai',     42),
  ('copilot',    'Copilot',                'ai',     43),
  ('claude',     'Claude',                 'ai',     44),
  ('gmail',      'Gmail',                  'email',  50),
  ('outlook',    'Outlook',                'email',  51),
  ('yahoo-mail', 'Yahoo Mail',             'email',  52),
  ('direct',     'Typed in or bookmarked', 'direct', 90),
  ('other',      'Other',                  'other',  99);


-- -------------------------------------------------------------------------------------
-- Security: only the service role (apps/api) may touch these tables
-- -------------------------------------------------------------------------------------

alter table public.channels              enable row level security;
alter table public.platforms             enable row level security;
alter table public.users                 enable row level security;
alter table public.workspaces            enable row level security;
alter table public.workspace_members     enable row level security;
alter table public.sites                 enable row level security;
alter table public.salts                 enable row level security;
alter table public.visits                enable row level security;
alter table public.page_views            enable row level security;
alter table public.social_accounts       enable row level security;
alter table public.social_account_tokens enable row level security;
alter table public.social_daily_stats    enable row level security;

-- Supabase grants its public API roles access to new tables by default; take it away so the
-- anon/publishable key can't even see that these tables exist. (Skipped on plain Postgres.)
do $$
declare r text;
begin
  foreach r in array array['anon', 'authenticated'] loop
    if exists (select 1 from pg_roles where rolname = r) then
      execute format('revoke all on all tables in schema public from %I', r);
      execute format('revoke all on all sequences in schema public from %I', r);
      execute format('revoke all on all functions in schema public from %I', r);
      execute format('alter default privileges in schema public revoke all on tables from %I', r);
      execute format('alter default privileges in schema public revoke all on sequences from %I', r);
      execute format('alter default privileges in schema public revoke all on functions from %I', r);
    end if;
  end loop;
end $$;
