-- Reset for a database created from an earlier draft of the migrations.
-- DELETES every app table, function and its data. Run it only while there is no real data,
-- then run every file in supabase/migrations/ in order.

drop function if exists
  public.get_or_create_salt,
  public.cleanup_salts,
  public.record_page_view,
  public.stats_kpis,
  public.stats_series,
  public.stats_breakdown,
  public.stats_live,
  public.stats_site_daily,
  public.stats_visits_by_platform,
  public.purge_expired_data
  cascade;

drop table if exists
  public.page_views,
  public.pageviews,
  public.visits,
  public.sessions,
  public.salts,
  public.social_daily_stats,
  public.social_account_tokens,
  public.social_accounts,
  public.sites,
  public.workspace_members,
  public.workspaces,
  public.users,
  public.platforms,
  public.channels
  cascade;

drop type if exists
  public.channel,
  public.device,
  public.member_role,
  public.social_platform,
  public.social_account_status
  cascade;

drop function if exists public.set_updated_at() cascade;
