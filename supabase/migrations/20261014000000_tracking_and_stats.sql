-- =====================================================================================
-- TrackerLens: functions for tracking (Phase 2), stats (Phase 3) and retention (Phase 6).
-- The API calls them with supabase-js `rpc()`. Each one is a single round trip, which keeps
-- serverless requests fast and makes "record a page view" atomic.
-- =====================================================================================


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
  v_id uuid;
begin
  -- One visitor's hits are handled one at a time, so two fast hits can't open two visits.
  perform pg_advisory_xact_lock(hashtextextended(p_site_id::text || p_visitor_hash, 0));

  select v.id into v_id
  from public.visits v
  where v.site_id = p_site_id
    and v.visitor_hash = p_visitor_hash
    and v.last_seen_at >= p_at - make_interval(mins => p_timeout_minutes)
  order by v.last_seen_at desc
  limit 1;

  if v_id is null then
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
    returning id into v_id;
    o_new_visit := true;
  else
    -- Where a visit came from is decided by its first page view, so the source is not touched.
    update public.visits
    set pageview_count = pageview_count + 1,
        last_seen_at = greatest(last_seen_at, p_at),
        exit_path = p_path
    where id = v_id;
    o_new_visit := false;
  end if;

  insert into public.page_views (visit_id, site_id, viewed_at, path)
  values (v_id, p_site_id, p_at, p_path);

  -- "Last visit" is updated at most once a minute; the first ever hit is remembered.
  update public.sites
  set last_event_at = p_at,
      first_event_at = coalesce(first_event_at, p_at)
  where id = p_site_id
    and (last_event_at is null or last_event_at < p_at - interval '1 minute');

  o_visit_id := v_id;
  return next;
end;
$$;
comment on function public.record_page_view is
  'Records one page view: extends the visitor''s visit if it was active in the last 30 minutes, '
  'otherwise starts a new visit with the given source. Also updates the site''s last/first event.';


-- -------------------------------------------------------------------------------------
-- Stats. Every function takes the same filters:
--   p_site_ids  sites to include (already checked to belong to the workspace by the API)
--   p_start/p_end  [start, end) instants
--   p_channels  null = all channels, else only these
--   p_device    null = all devices
--   p_country   null = all countries, else an ISO-2 code
-- -------------------------------------------------------------------------------------

create function public.stats_kpis(
  p_site_ids uuid[], p_start timestamptz, p_end timestamptz,
  p_channels text[] default null, p_device public.device default null, p_country text default null
)
returns table (visits bigint, visitors bigint, pageviews bigint)
language sql stable as $$
  select
    (select count(*) from public.visits v
       where v.site_id = any(p_site_ids) and v.started_at >= p_start and v.started_at < p_end
         and (p_channels is null or v.channel_id = any(p_channels))
         and (p_device is null or v.device = p_device)
         and (p_country is null or v.country_code = p_country)),
    (select count(distinct v.visitor_hash) from public.visits v
       where v.site_id = any(p_site_ids) and v.started_at >= p_start and v.started_at < p_end
         and (p_channels is null or v.channel_id = any(p_channels))
         and (p_device is null or v.device = p_device)
         and (p_country is null or v.country_code = p_country)),
    (select count(*) from public.page_views pv
       join public.visits v on v.id = pv.visit_id
       where pv.site_id = any(p_site_ids) and pv.viewed_at >= p_start and pv.viewed_at < p_end
         and (p_channels is null or v.channel_id = any(p_channels))
         and (p_device is null or v.device = p_device)
         and (p_country is null or v.country_code = p_country));
$$;
comment on function public.stats_kpis is 'Visits, unique visitors (distinct daily hashes) and page views in a range.';

create function public.stats_series(
  p_site_ids uuid[], p_start timestamptz, p_end timestamptz, p_unit text, p_tz text,
  p_channels text[] default null, p_device public.device default null, p_country text default null
)
returns table (bucket text, channel_id text, visits bigint)
language sql stable as $$
  select to_char(date_trunc(p_unit, v.started_at at time zone p_tz), 'YYYY-MM-DD'), v.channel_id, count(*)
  from public.visits v
  where v.site_id = any(p_site_ids) and v.started_at >= p_start and v.started_at < p_end
    and (p_channels is null or v.channel_id = any(p_channels))
    and (p_device is null or v.device = p_device)
    and (p_country is null or v.country_code = p_country)
  group by 1, 2;
$$;
comment on function public.stats_series is
  'Visits per bucket (day/week/month/year in the workspace timezone; weeks start Monday) and channel. '
  'bucket is the local start date, YYYY-MM-DD.';

create function public.stats_breakdown(
  p_dimension text, p_limit integer,
  p_site_ids uuid[], p_start timestamptz, p_end timestamptz,
  p_channels text[] default null, p_device public.device default null, p_country text default null
)
returns table (key text, label text, detail text, channel_id text, value bigint)
language plpgsql stable as $$
begin
  if p_dimension = 'page' then
    -- Pages count page views; the site's domain is the detail (useful when showing all sites).
    return query
      select s.domain || pv.path, pv.path, s.domain, null::text, count(*)
      from public.page_views pv
      join public.visits v on v.id = pv.visit_id
      join public.sites s on s.id = pv.site_id
      where pv.site_id = any(p_site_ids) and pv.viewed_at >= p_start and pv.viewed_at < p_end
        and (p_channels is null or v.channel_id = any(p_channels))
        and (p_device is null or v.device = p_device)
        and (p_country is null or v.country_code = p_country)
      group by s.domain, pv.path
      order by 5 desc, 1
      limit p_limit;
    return;
  end if;

  return query
    with f as (
      select v.* from public.visits v
      where v.site_id = any(p_site_ids) and v.started_at >= p_start and v.started_at < p_end
        and (p_channels is null or v.channel_id = any(p_channels))
        -- Device and country lists show every option (the UI dims unselected rows).
        and (p_dimension = 'device' or p_device is null or v.device = p_device)
        and (p_dimension = 'country' or p_country is null or v.country_code = p_country)
    )
    select
      case p_dimension
        when 'platform' then case when f.platform_id = 'other' then 'other:' || coalesce(f.source_detail, '') else f.platform_id end
        when 'campaign' then f.utm_campaign
        when 'country' then f.country_code
        when 'device' then f.device::text
      end as k,
      min(case p_dimension
        when 'platform' then case when f.platform_id = 'other' then coalesce(f.source_detail, p.label) else p.label end
        when 'campaign' then f.utm_campaign
        when 'country' then f.country_code
        when 'device' then f.device::text
      end),
      case when p_dimension = 'campaign' then mode() within group (order by p.label) end,
      mode() within group (order by f.channel_id),
      count(*)
    from f
    join public.platforms p on p.id = f.platform_id
    where p_dimension <> 'campaign' or f.utm_campaign is not null
    group by 1
    order by 5 desc, 1
    limit p_limit;
end;
$$;
comment on function public.stats_breakdown is
  'Top rows for one dimension: platform, page, campaign, country or device. Pages count page views; '
  'the rest count visits. For unknown sources the platform key is "other:<host or utm_source>".';

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

create function public.stats_site_daily(
  p_site_ids uuid[], p_start timestamptz, p_end timestamptz, p_tz text
)
returns table (site_id uuid, day text, visits bigint)
language sql stable as $$
  select v.site_id, to_char(v.started_at at time zone p_tz, 'YYYY-MM-DD'), count(*)
  from public.visits v
  where v.site_id = any(p_site_ids) and v.started_at >= p_start and v.started_at < p_end
  group by 1, 2;
$$;
comment on function public.stats_site_daily is 'Visits per site per local day, for site cards and sparklines.';

create function public.stats_visits_by_platform(
  p_site_ids uuid[], p_start timestamptz, p_end timestamptz, p_tz text, p_unit text
)
returns table (platform_id text, bucket text, visits bigint)
language sql stable as $$
  select v.platform_id, to_char(date_trunc(p_unit, v.started_at at time zone p_tz), 'YYYY-MM-DD'), count(*)
  from public.visits v
  where v.site_id = any(p_site_ids) and v.started_at >= p_start and v.started_at < p_end
  group by 1, 2;
$$;
comment on function public.stats_visits_by_platform is 'Website visits per platform and bucket (used by the Social page).';


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
begin
  for w in select id, retention_months from public.workspaces loop
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
  end loop;
  visits_deleted := v_v;
  page_views_deleted := v_pv;
  return next;
end;
$$;
comment on function public.purge_expired_data() is
  'Deletes visits and page views older than each workspace''s retention_months. Run weekly by cron.';


-- -------------------------------------------------------------------------------------
-- Security: functions are callable only by the service role (apps/api)
-- -------------------------------------------------------------------------------------

revoke execute on all functions in schema public from public;
do $$
declare r text;
begin
  foreach r in array array['anon', 'authenticated'] loop
    if exists (select 1 from pg_roles where rolname = r) then
      execute format('revoke execute on all functions in schema public from %I', r);
    end if;
  end loop;
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant execute on all functions in schema public to service_role;
  end if;
end $$;
