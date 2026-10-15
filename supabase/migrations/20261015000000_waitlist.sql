-- =====================================================================================
-- TrackerLens: the public waitlist (/waitlist). People leave an email, and optionally the
-- website they want to count, before they get an account. Not linked to users or
-- workspaces: someone on the waitlist has no account yet.
-- =====================================================================================

create table public.waitlist_signups (
  id         uuid primary key default gen_random_uuid(),
  email      text not null unique check (email = lower(email) and position('@' in email) > 1),
  website    text check (website is null or website = lower(website)),
  created_at timestamptz not null default now()
);
comment on table public.waitlist_signups is
  'People who asked to join the waitlist on /waitlist. One row per email; joining again keeps '
  'the first row.';
comment on column public.waitlist_signups.id is 'Row id.';
comment on column public.waitlist_signups.email is 'Email to contact when a place opens, always lowercase.';
comment on column public.waitlist_signups.website is
  'Optional bare hostname of the website they want to count (no protocol, path or "www.").';
comment on column public.waitlist_signups.created_at is 'When they first joined the waitlist.';
alter table public.waitlist_signups enable row level security;

-- Only the API (service role) may read or write it, as with every other table. The default
-- privileges from the first migration should already cover this; revoke explicitly anyway.
-- (Skipped on plain Postgres.)
do $$
declare r text;
begin
  foreach r in array array['anon', 'authenticated'] loop
    if exists (select 1 from pg_roles where rolname = r) then
      execute format('revoke all on table public.waitlist_signups from %I', r);
    end if;
  end loop;
end $$;
