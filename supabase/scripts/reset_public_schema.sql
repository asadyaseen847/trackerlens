-- One-time reset for a database created from an earlier draft of the initial migration.
-- DELETES every app table and its data. Run it only while there is no real data, then run
-- supabase/migrations/20261013000000_initial_schema.sql.

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
