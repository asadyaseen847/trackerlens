-- =====================================================================================
-- TrackerLens: tracking (Phase 2), stats (Phase 3), daily rollups and retention (Phase 6).
-- The API calls these functions with supabase-js `rpc()`. Each is one round trip, which keeps
-- serverless requests fast, and recording a page view is atomic.
-- =====================================================================================


-- -------------------------------------------------------------------------------------
-- Daily rollups (Phase 6 performance). record_page_view keeps them current, so every
-- dashboard number reads a rollup instead of scanning visits and page views. Days are local
-- dates in the workspace timezone. Derived data: rebuild_daily_stats() recreates them all.
--
--   daily_totals       site, day, channel, device                   KPIs and chart, device list
--   daily_stats        + platform, source, campaign, country        country filter, other lists
--   daily_page_totals  site, day, path                              Pages list
--   daily_page_stats   + channel, device, country                   Pages list with filters
--
-- Each query reads the smallest table that can answer it.
-- -------------------------------------------------------------------------------------

create table public.daily_totals (
  site_id    uuid not null references public.sites (id) on delete cascade,
  day        date not null,
  channel_id text not null references public.channels (id),
  device     public.device not null,
  visits     integer not null default 0 check (visits >= 0),
  visitors   integer not null default 0 check (visitors >= 0),
  pageviews  integer not null default 0 check (pageviews >= 0),
  primary key (site_id, day, channel_id, device)
);
comment on table public.daily_totals is
  'daily_stats summed over platform, campaign and country: the KPIs and chart without a country '
  'filter. Updated with every page view; rebuilt by rebuild_daily_stats().';
comment on column public.daily_totals.day is 'Local calendar day in the workspace timezone.';
comment on column public.daily_totals.channel_id is 'Channel of the visits in this row.';
comment on column public.daily_totals.device is 'Device of the visits in this row.';
comment on column public.daily_totals.visits is 'Visits that started on this day.';
comment on column public.daily_totals.visitors is
  'Visitors whose first visit of the day (on this site) had this channel and device.';
comment on column public.daily_totals.pageviews is 'Page views viewed on this day, in visits of this channel and device.';
alter table public.daily_totals enable row level security;


create table public.daily_stats (
  site_id       uuid not null references public.sites (id) on delete cascade,
  day           date not null,
  channel_id    text not null references public.channels (id),
  platform_id   text not null references public.platforms (id),
  source_detail text not null default '',
  utm_campaign  text not null default '',
  device        public.device not null,
  country_code  char(2) not null,
  visits        integer not null default 0 check (visits >= 0),
  visitors      integer not null default 0 check (visitors >= 0),
  pageviews     integer not null default 0 check (pageviews >= 0),
  primary key (site_id, day, channel_id, platform_id, source_detail, utm_campaign, device, country_code)
);
comment on table public.daily_stats is
  'Visits, visitors and page views per site, local day and visit segment (channel, platform, '
  'campaign, device, country). Updated with every page view; rebuilt by rebuild_daily_stats() '
  'after imports or a timezone change.';
comment on column public.daily_stats.day is 'Local calendar day in the workspace timezone.';
comment on column public.daily_stats.channel_id is 'Channel of the visits in this row (visits.channel_id).';
comment on column public.daily_stats.platform_id is 'Platform of the visits in this row (visits.platform_id).';
comment on column public.daily_stats.source_detail is
  'visits.source_detail, or an empty string when there is none (it is part of the primary key).';
comment on column public.daily_stats.utm_campaign is
  'visits.utm_campaign, or an empty string when there is none (it is part of the primary key).';
comment on column public.daily_stats.device is 'Device of the visits in this row (visits.device).';
comment on column public.daily_stats.country_code is 'Country of the visits in this row (visits.country_code).';
comment on column public.daily_stats.visits is 'Visits that started on this day in this segment.';
comment on column public.daily_stats.visitors is
  'Visitors whose first visit of the day (on this site) was in this segment. Summed over any '
  'set of segments this counts each visitor at most once per day.';
comment on column public.daily_stats.pageviews is 'Page views viewed on this day, in visits of this segment.';
alter table public.daily_stats enable row level security;
create index daily_stats_site_country_day_idx on public.daily_stats (site_id, country_code, day);

create table public.daily_page_totals (
  site_id   uuid not null references public.sites (id) on delete cascade,
  day       date not null,
  path      text not null,
  pageviews integer not null default 0 check (pageviews >= 0),
  primary key (site_id, day, path)
);
comment on table public.daily_page_totals is
  'Page views per site, local day and path: the "Pages" list without filters. Updated with every '
  'page view; rebuilt by rebuild_daily_stats().';
comment on column public.daily_page_totals.day is 'Local calendar day in the workspace timezone.';
comment on column public.daily_page_totals.path is 'Page path, as in page_views.path.';
comment on column public.daily_page_totals.pageviews is 'Page views of this path on this day.';
alter table public.daily_page_totals enable row level security;

create table public.daily_page_stats (
  site_id      uuid not null references public.sites (id) on delete cascade,
  day          date not null,
  path         text not null,
  channel_id   text not null references public.channels (id),
  device       public.device not null,
  country_code char(2) not null,
  pageviews    integer not null default 0 check (pageviews >= 0),
  primary key (site_id, day, path, channel_id, device, country_code)
);
comment on table public.daily_page_stats is
  'Page views per site, local day, path and the filterable parts of the visit (channel, device, '
  'country): the "Pages" list with filters. Updated with every page view; rebuilt by '
  'rebuild_daily_stats().';
comment on column public.daily_page_stats.day is 'Local calendar day in the workspace timezone.';
comment on column public.daily_page_stats.path is 'Page path, as in page_views.path.';
comment on column public.daily_page_stats.channel_id is 'Channel of the visit the page views belong to.';
comment on column public.daily_page_stats.device is 'Device of the visit the page views belong to.';
comment on column public.daily_page_stats.country_code is 'Country of the visit the page views belong to.';
comment on column public.daily_page_stats.pageviews is 'Page views of this path on this day in this segment.';
alter table public.daily_page_stats enable row level security;
create index daily_page_stats_site_country_day_idx on public.daily_page_stats (site_id, country_code, day);


-- -------------------------------------------------------------------------------------
-- Tracking
-- -------------------------------------------------------------------------------------

create function public.get_or_create_salt(p_day date, p_candidate text)
returns text
language sql as $$
  with inserted as (
    insert into public.salts (day, value) values (p_day, p_candidate)
    on conflict (day) do nothing
    returning value
  )
  select value from inserted
  union all
  select value from public.salts where day = p_day
  limit 1;
$$;
comment on function public.get_or_create_salt(date, text) is
  'Returns the salt for a UTC day, storing p_candidate if the day has none yet (first caller wins).';

create function public.cleanup_salts(p_before date)
returns integer
language sql as $$
  with deleted as (delete from public.salts where day < p_before returning 1)
  select count(*)::integer from deleted;
$$;
comment on function public.cleanup_salts(date) is 'Deletes salts for days before p_before. Returns how many.';

create function public.record_page_view(
  p_site_id uuid,
  p_visitor_hash text,
  p_at timestamptz,
  p_path text,
  p_channel_id text,
  p_platform_id text,
  p_source_detail text,
  p_is_paid boolean,
  p_referrer_host text,
  p_utm_source text,
  p_utm_medium text,
  p_utm_campaign text,
  p_utm_term text,
  p_utm_content text,
  p_country_code text,
  p_device public.device,
  p_browser text,
  p_os text,
  p_timeout_minutes integer default 30
)
returns table (o_visit_id uuid, o_new_visit boolean)
language plpgsql as $$
declare
  v public.visits%rowtype;
  v_tz text;
  v_day date;
  v_first boolean;
begin
  select w.timezone into v_tz
  from public.sites s join public.workspaces w on w.id = s.workspace_id
  where s.id = p_site_id;
  v_day := (p_at at time zone v_tz)::date;

  -- One visitor's hits are handled one at a time, so two fast hits can't open two visits.
  perform pg_advisory_xact_lock(hashtextextended(p_site_id::text || p_visitor_hash, 0));

  select * into v
  from public.visits
  where site_id = p_site_id
    and visitor_hash = p_visitor_hash
    and last_seen_at >= p_at - make_interval(mins => p_timeout_minutes)
  order by last_seen_at desc
  limit 1;

  if v.id is null then
    -- Is this the visitor's first visit of the (local) day on this site?
    v_first := not exists (
      select 1 from public.visits x
      where x.site_id = p_site_id
        and x.visitor_hash = p_visitor_hash
        and x.started_at >= (v_day::timestamp at time zone v_tz)
        and x.started_at <= p_at
    );
    insert into public.visits (
      site_id, visitor_hash, started_at, last_seen_at, pageview_count, entry_path, exit_path,
      channel_id, platform_id, source_detail, is_paid, referrer_host,
      utm_source, utm_medium, utm_campaign, utm_term, utm_content,
      country_code, device, browser, os
    ) values (
      p_site_id, p_visitor_hash, p_at, p_at, 1, p_path, p_path,
      p_channel_id, p_platform_id, p_source_detail, p_is_paid, p_referrer_host,
      p_utm_source, p_utm_medium, p_utm_campaign, p_utm_term, p_utm_content,
      p_country_code, p_device, p_browser, p_os
    )
    returning * into v;
    o_new_visit := true;
  else
    -- Where a visit came from is decided by its first page view, so the source is not touched.
    update public.visits
    set pageview_count = pageview_count + 1,
        last_seen_at = greatest(last_seen_at, p_at),
        exit_path = p_path
    where id = v.id;
    v_first := false;
    o_new_visit := false;
  end if;

  insert into public.page_views (visit_id, site_id, viewed_at, path)
  values (v.id, p_site_id, p_at, p_path);

  -- Rollups: a new visit adds a visit (and maybe a visitor); every hit adds a page view on
  -- the day it happens, in the segment of its visit.
  insert into public.daily_stats as d (
    site_id, day, channel_id, platform_id, source_detail, utm_campaign, device, country_code,
    visits, visitors, pageviews
  ) values (
    p_site_id, v_day, v.channel_id, v.platform_id, coalesce(v.source_detail, ''),
    coalesce(v.utm_campaign, ''), v.device, v.country_code,
    o_new_visit::int, v_first::int, 1
  )
  on conflict (site_id, day, channel_id, platform_id, source_detail, utm_campaign, device, country_code)
  do update set visits = d.visits + excluded.visits,
                visitors = d.visitors + excluded.visitors,
                pageviews = d.pageviews + 1;

  insert into public.daily_totals as d (site_id, day, channel_id, device, visits, visitors, pageviews)
  values (p_site_id, v_day, v.channel_id, v.device, o_new_visit::int, v_first::int, 1)
  on conflict (site_id, day, channel_id, device)
  do update set visits = d.visits + excluded.visits,
                visitors = d.visitors + excluded.visitors,
                pageviews = d.pageviews + 1;

  insert into public.daily_page_stats as d (site_id, day, path, channel_id, device, country_code, pageviews)
  values (p_site_id, v_day, p_path, v.channel_id, v.device, v.country_code, 1)
  on conflict (site_id, day, path, channel_id, device, country_code)
  do update set pageviews = d.pageviews + 1;

  insert into public.daily_page_totals as d (site_id, day, path, pageviews)
  values (p_site_id, v_day, p_path, 1)
  on conflict (site_id, day, path) do update set pageviews = d.pageviews + 1;

  -- "Last visit" is updated at most once a minute; the first ever hit is remembered.
  update public.sites
  set last_event_at = p_at,
      first_event_at = coalesce(first_event_at, p_at)
  where id = p_site_id
    and (last_event_at is null or last_event_at < p_at - interval '1 minute');

  o_visit_id := v.id;
  return next;
end;
$$;
comment on function public.record_page_view is
  'Records one page view: extends the visitor''s visit if it was active in the last 30 minutes, '
  'otherwise starts a new visit with the given source. Updates the daily rollups and the site''s '
  'first/last event in the same transaction.';

create function public.rebuild_daily_stats(p_site_ids uuid[])
returns integer
language plpgsql as $$
declare n integer;
begin
  delete from public.daily_stats where site_id = any(p_site_ids);
  delete from public.daily_page_stats where site_id = any(p_site_ids);
  delete from public.daily_totals where site_id = any(p_site_ids);
  delete from public.daily_page_totals where site_id = any(p_site_ids);

  create temporary table rebuild_visits on commit drop as
  select v.id, v.site_id, (v.started_at at time zone w.timezone)::date as day, w.timezone,
         v.channel_id, v.platform_id, coalesce(v.source_detail, '') as source_detail,
         coalesce(v.utm_campaign, '') as utm_campaign, v.device, v.country_code,
         row_number() over (
           partition by v.site_id, v.visitor_hash, (v.started_at at time zone w.timezone)::date
           order by v.started_at
         ) = 1 as first_of_day
  from public.visits v
  join public.sites s on s.id = v.site_id
  join public.workspaces w on w.id = s.workspace_id
  where v.site_id = any(p_site_ids);

  with visit_counts as (
    select site_id, day, channel_id, platform_id, source_detail, utm_campaign, device, country_code,
           count(*) as visits, count(*) filter (where first_of_day) as visitors
    from rebuild_visits group by 1, 2, 3, 4, 5, 6, 7, 8
  ),
  page_counts as (
    select v.site_id, (pv.viewed_at at time zone v.timezone)::date as day, v.channel_id,
           v.platform_id, v.source_detail, v.utm_campaign, v.device, v.country_code,
           count(*) as pageviews
    from public.page_views pv join rebuild_visits v on v.id = pv.visit_id
    group by 1, 2, 3, 4, 5, 6, 7, 8
  )
  insert into public.daily_stats (
    site_id, day, channel_id, platform_id, source_detail, utm_campaign, device, country_code,
    visits, visitors, pageviews
  )
  select site_id, day, channel_id, platform_id, source_detail, utm_campaign, device, country_code,
         coalesce(vc.visits, 0), coalesce(vc.visitors, 0), coalesce(pc.pageviews, 0)
  from visit_counts vc
  full join page_counts pc
    using (site_id, day, channel_id, platform_id, source_detail, utm_campaign, device, country_code);
  get diagnostics n = row_count;

  insert into public.daily_page_stats (site_id, day, path, channel_id, device, country_code, pageviews)
  select v.site_id, (pv.viewed_at at time zone v.timezone)::date, pv.path, v.channel_id, v.device,
         v.country_code, count(*)
  from public.page_views pv join rebuild_visits v on v.id = pv.visit_id
  group by 1, 2, 3, 4, 5, 6;

  -- The summary tables are projections of the detailed ones.
  insert into public.daily_totals (site_id, day, channel_id, device, visits, visitors, pageviews)
  select site_id, day, channel_id, device, sum(visits), sum(visitors), sum(pageviews)
  from public.daily_stats where site_id = any(p_site_ids)
  group by 1, 2, 3, 4;

  insert into public.daily_page_totals (site_id, day, path, pageviews)
  select site_id, day, path, sum(pageviews)
  from public.daily_page_stats where site_id = any(p_site_ids)
  group by 1, 2, 3;

  drop table rebuild_visits;
  return n;
end;
$$;
comment on function public.rebuild_daily_stats(uuid[]) is
  'Recreates every daily rollup for the given sites from visits and page_views. '
  'Run after bulk imports and when a workspace changes its timezone. Returns the daily_stats rows.';


-- -------------------------------------------------------------------------------------
-- Stats. Days are local dates (workspace timezone), inclusive. Filters: site ids (checked
-- against the workspace by the API), channels, device and country (null = all). Visitors
-- are counted once per day, in the segment of their first visit that day.
-- -------------------------------------------------------------------------------------

create function public.stats_kpis(
  p_site_ids uuid[], p_from date, p_to date,
  p_channels text[] default null, p_device public.device default null, p_country text default null
)
returns table (visits bigint, visitors bigint, pageviews bigint)
language plpgsql stable as $$
begin
  if p_country is null then
    return query
      select coalesce(sum(d.visits), 0)::bigint, coalesce(sum(d.visitors), 0)::bigint,
             coalesce(sum(d.pageviews), 0)::bigint
      from public.daily_totals d
      where d.site_id = any(p_site_ids) and d.day between p_from and p_to
        and (p_channels is null or d.channel_id = any(p_channels))
        and (p_device is null or d.device = p_device);
  else
    return query
      select coalesce(sum(d.visits), 0)::bigint, coalesce(sum(d.visitors), 0)::bigint,
             coalesce(sum(d.pageviews), 0)::bigint
      from public.daily_stats d
      where d.site_id = any(p_site_ids) and d.country_code = p_country
        and d.day between p_from and p_to
        and (p_channels is null or d.channel_id = any(p_channels))
        and (p_device is null or d.device = p_device);
  end if;
end;
$$;
comment on function public.stats_kpis is 'Visits, visitors and page views between two local days, from the rollups.';

create function public.stats_series(
  p_site_ids uuid[], p_from date, p_to date, p_unit text,
  p_channels text[] default null, p_device public.device default null, p_country text default null
)
returns table (bucket text, channel_id text, visits bigint)
language plpgsql stable as $$
begin
  if p_country is null then
    return query
      select to_char(date_trunc(p_unit, d.day::timestamp), 'YYYY-MM-DD'), d.channel_id, sum(d.visits)::bigint
      from public.daily_totals d
      where d.site_id = any(p_site_ids) and d.day between p_from and p_to
        and (p_channels is null or d.channel_id = any(p_channels))
        and (p_device is null or d.device = p_device)
      group by 1, 2;
  else
    return query
      select to_char(date_trunc(p_unit, d.day::timestamp), 'YYYY-MM-DD'), d.channel_id, sum(d.visits)::bigint
      from public.daily_stats d
      where d.site_id = any(p_site_ids) and d.country_code = p_country
        and d.day between p_from and p_to
        and (p_channels is null or d.channel_id = any(p_channels))
        and (p_device is null or d.device = p_device)
      group by 1, 2;
  end if;
end;
$$;
comment on function public.stats_series is
  'Visits per bucket (day/week/month/year; weeks start Monday) and channel, from the rollups.';

create function public.stats_breakdown(
  p_dimension text, p_limit integer, p_site_ids uuid[], p_from date, p_to date,
  p_channels text[] default null, p_device public.device default null, p_country text default null
)
returns table (key text, label text, detail text, channel_id text, value bigint)
language plpgsql stable as $$
begin
  if p_dimension = 'page' then
    -- Pages count page views; the site's domain is the detail.
    return query
      select s.domain || t.path, t.path, s.domain, null::text, t.n
      from (
        select d.site_id, d.path, sum(d.pageviews)::bigint as n
        from public.daily_page_totals d
        where p_channels is null and p_device is null and p_country is null
          and d.site_id = any(p_site_ids) and d.day between p_from and p_to
        group by 1, 2
        union all
        select d.site_id, d.path, sum(d.pageviews)::bigint
        from public.daily_page_stats d
        where not (p_channels is null and p_device is null and p_country is null)
          and d.site_id = any(p_site_ids) and d.day between p_from and p_to
          and (p_channels is null or d.channel_id = any(p_channels))
          and (p_device is null or d.device = p_device)
          and (p_country is null or d.country_code = p_country)
        group by 1, 2
        order by 3 desc limit p_limit
      ) t join public.sites s on s.id = t.site_id
      order by t.n desc, 1;
    return;
  end if;

  if p_dimension = 'device' and p_country is null then
    -- Every device stays listed (the UI dims unselected ones), so the list ignores its own filter.
    return query
      select t.k, t.k, null::text, null::text, t.n
      from (
        select d.device::text as k, sum(d.visits)::bigint as n
        from public.daily_totals d
        where d.site_id = any(p_site_ids) and d.day between p_from and p_to
          and (p_channels is null or d.channel_id = any(p_channels))
        group by 1
      ) t
      where t.n > 0
      order by t.n desc, 1
      limit p_limit;
    return;
  end if;

  if p_dimension in ('country', 'device') then
    return query
      select t.k, t.k, null::text, null::text, t.n
      from (
        select case when p_dimension = 'country' then d.country_code::text else d.device::text end as k,
               sum(d.visits)::bigint as n
        from public.daily_stats d
        where d.site_id = any(p_site_ids) and d.day between p_from and p_to
          and (p_channels is null or d.channel_id = any(p_channels))
          and (p_dimension = 'device' or p_device is null or d.device = p_device)
          and (p_dimension = 'country' or p_country is null or d.country_code = p_country)
        group by 1
      ) t
      where t.n > 0
      order by t.n desc, 1
      limit p_limit;
    return;
  end if;

  if p_dimension not in ('platform', 'campaign') then
    raise exception 'stats_breakdown: unknown dimension %', p_dimension;
  end if;

  -- Platforms: unknown sources are listed by host or utm_source (key "other:<detail>").
  -- Campaigns: utm_campaign, with the platform that sent most of its visits as the detail.
  return query
    with g as (
      select case
               when p_dimension = 'campaign' then d.utm_campaign
               when d.platform_id = 'other' then 'other:' || d.source_detail
               else d.platform_id
             end as k,
             d.platform_id, d.source_detail, d.channel_id, sum(d.visits)::bigint as n
      from public.daily_stats d
      where d.site_id = any(p_site_ids) and d.day between p_from and p_to
        and (p_channels is null or d.channel_id = any(p_channels))
        and (p_device is null or d.device = p_device)
        and (p_country is null or d.country_code = p_country)
        and (p_dimension <> 'campaign' or d.utm_campaign <> '')
      group by 1, 2, 3, 4
    ),
    named as (
      select g.k, g.n, g.channel_id,
             case when g.platform_id = 'other' then coalesce(nullif(g.source_detail, ''), p.label)
                  else p.label end as platform_name
      from g join public.platforms p on p.id = g.platform_id
    )
    select named.k,
           case when p_dimension = 'platform' then (array_agg(platform_name order by n desc))[1] else named.k end,
           case when p_dimension = 'campaign' then (array_agg(platform_name order by n desc))[1] end,
           (array_agg(named.channel_id order by n desc))[1],
           sum(n)::bigint
    from named
    group by named.k
    having sum(n) > 0
    order by 5 desc, 1
    limit p_limit;
end;
$$;
comment on function public.stats_breakdown is
  'Top rows for one dimension: platform, page, campaign, country or device, from the rollups. '
  'Pages count page views; the rest count visits. Unknown sources have the key "other:<detail>".';

create function public.stats_site_daily(p_site_ids uuid[], p_from date, p_to date)
returns table (site_id uuid, day text, visits bigint)
language sql stable as $$
  select d.site_id, to_char(d.day, 'YYYY-MM-DD'), sum(d.visits)::bigint
  from public.daily_totals d
  where d.site_id = any(p_site_ids) and d.day between p_from and p_to
  group by 1, 2;
$$;
comment on function public.stats_site_daily is 'Visits per site per local day (site cards and sparklines).';

create function public.stats_live(
  p_site_ids uuid[], p_since timestamptz,
  p_channels text[] default null, p_device public.device default null, p_country text default null
)
returns bigint
language sql stable as $$
  select count(distinct v.visitor_hash)
  from public.visits v
  where v.site_id = any(p_site_ids) and v.last_seen_at >= p_since
    and (p_channels is null or v.channel_id = any(p_channels))
    and (p_device is null or v.device = p_device)
    and (p_country is null or v.country_code = p_country);
$$;
comment on function public.stats_live is 'Distinct visitors seen since p_since ("on the site right now" uses 5 minutes).';


-- -------------------------------------------------------------------------------------
-- Retention (Phase 6)
-- -------------------------------------------------------------------------------------

create function public.purge_expired_data()
returns table (visits_deleted bigint, page_views_deleted bigint)
language plpgsql as $$
declare
  v_pv bigint := 0;
  v_v bigint := 0;
  n bigint;
  w record;
  v_cutoff date;
begin
  for w in select id, retention_months, timezone from public.workspaces loop
    delete from public.page_views pv
    using public.sites s
    where pv.site_id = s.id and s.workspace_id = w.id
      and pv.viewed_at < now() - make_interval(months => w.retention_months);
    get diagnostics n = row_count; v_pv := v_pv + n;

    delete from public.visits v
    using public.sites s
    where v.site_id = s.id and s.workspace_id = w.id
      and v.last_seen_at < now() - make_interval(months => w.retention_months);
    get diagnostics n = row_count; v_v := v_v + n;

    v_cutoff := ((now() - make_interval(months => w.retention_months)) at time zone w.timezone)::date;
    delete from public.daily_totals d using public.sites s
    where d.site_id = s.id and s.workspace_id = w.id and d.day < v_cutoff;
    delete from public.daily_stats d using public.sites s
    where d.site_id = s.id and s.workspace_id = w.id and d.day < v_cutoff;
    delete from public.daily_page_totals d using public.sites s
    where d.site_id = s.id and s.workspace_id = w.id and d.day < v_cutoff;
    delete from public.daily_page_stats d using public.sites s
    where d.site_id = s.id and s.workspace_id = w.id and d.day < v_cutoff;
  end loop;
  visits_deleted := v_v;
  page_views_deleted := v_pv;
  return next;
end;
$$;
comment on function public.purge_expired_data() is
  'Deletes visits, page views and rollups older than each workspace''s retention_months. Run weekly by cron.';


-- -------------------------------------------------------------------------------------
-- Security: functions are callable only by the service role (apps/api)
-- -------------------------------------------------------------------------------------

revoke execute on all functions in schema public from public;
do $$
declare r text;
begin
  foreach r in array array['anon', 'authenticated'] loop
    if exists (select 1 from pg_roles where rolname = r) then
      execute format(
        'revoke all on table public.daily_totals, public.daily_stats, public.daily_page_totals, '
        'public.daily_page_stats from %I', r);
      execute format('revoke execute on all functions in schema public from %I', r);
    end if;
  end loop;
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant execute on all functions in schema public to service_role;
  end if;
end $$;
