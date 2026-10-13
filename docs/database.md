# Database guide

The database is **Supabase Postgres**. The whole schema is one file:
[`supabase/migrations/20261013000000_initial_schema.sql`](../supabase/migrations/20261013000000_initial_schema.sql).
Every table and column also has a description, which Supabase shows in the **Table Editor**: hover a column name, or open a table's definition.

## The picture

```mermaid
erDiagram
    users ||--o{ workspace_members : "belongs to"
    workspaces ||--o{ workspace_members : "has"
    workspaces ||--o{ sites : "owns"
    workspaces ||--o{ social_accounts : "connects"
    sites ||--o{ visits : "receives"
    visits ||--|{ page_views : "contains"
    sites ||--o{ page_views : "scanned by"
    channels ||--o{ platforms : "groups"
    channels ||--o{ visits : "kind of source"
    platforms ||--o{ visits : "source"
    platforms ||--o{ social_accounts : "network"
    social_accounts ||--o| social_account_tokens : "secrets"
    social_accounts ||--o{ social_daily_stats : "daily numbers"

    users {
        uuid id PK
        text email UK
        text password_hash
        text name
    }
    workspaces {
        uuid id PK
        text name
        text timezone
        smallint retention_months
    }
    workspace_members {
        uuid workspace_id PK,FK
        uuid user_id PK,FK
        member_role role
    }
    sites {
        uuid id PK
        uuid workspace_id FK
        text domain
        text site_key UK
        bool include_subdomains
        bool paused
    }
    visits {
        uuid id PK
        uuid site_id FK
        text visitor_hash
        timestamptz started_at
        text channel_id FK
        text platform_id FK
        text source_detail
        char country_code
        device device
    }
    page_views {
        bigint id PK
        uuid visit_id FK
        uuid site_id FK
        timestamptz viewed_at
        text path
    }
    channels {
        text id PK
        text label
        smallint sort_order
    }
    platforms {
        text id PK
        text label
        text channel_id FK
    }
    social_accounts {
        uuid id PK
        uuid workspace_id FK
        text platform_id FK
        text handle
    }
    social_account_tokens {
        uuid social_account_id PK,FK
        text access_token_enc
    }
    social_daily_stats {
        uuid social_account_id PK,FK
        date day PK
        int followers
        bigint views
    }
    salts {
        date day PK
        text value
    }
```

## The tables in plain words

| Group    | Table                   | One row is…                                                                          |
| -------- | ----------------------- | ------------------------------------------------------------------------------------ |
| Accounts | `users`                 | a person who logs in to the dashboard                                                |
|          | `workspaces`            | a customer account (usually one company), with its timezone                          |
|          | `workspace_members`     | "this person belongs to this workspace, as owner or member"                          |
| Websites | `sites`                 | a tracked website and its settings; `site_key` goes in the tracking code             |
| Tracking | `visits`                | one visit: pages seen with no gap over 30 minutes, and where it came from            |
|          | `page_views`            | one page seen during a visit                                                         |
|          | `salts`                 | the random value used for one day's visitor hashes (deleted after 2 days)            |
| Lookups  | `channels`              | a kind of source: Social media, Search, Email, AI assistants, Direct, Other websites |
|          | `platforms`             | a known source (Instagram, Google, ChatGPT, …) and its channel                       |
| Social   | `social_accounts`       | a connected Instagram/Facebook/… profile                                             |
|          | `social_account_tokens` | that account's encrypted login tokens, kept apart                                    |
|          | `social_daily_stats`    | that account's followers and views for one day                                       |

## Design rules

1. **Third normal form.** Each fact lives in one place.
   - A page view stores only _which visit_, _when_ and _which page_.
   - Its source, device and country belong to the visit and are read with a join (example below).
   - Platform names and their channel live in `platforms`, not repeated on every visit.
2. **Lookup tables instead of loose text.**
   - `visits.platform_id` must be a row in `platforms`, so a typo can't create a new "platform".
   - Websites that aren't in the list (e.g. `news.ycombinator.com`) are stored as platform `other`, with the host in `visits.source_detail`.
3. **A visit keeps its own `channel_id`,** even though platforms have a channel. A campaign link can override it, e.g. `utm_source=newsletter&utm_medium=email` is Email. So the channel is a fact about the visit, not only about the platform.
4. **One deliberate shortcut: `page_views.site_id`.** It could be read from the visit, but every stats query scans "one site, one time range". The `(site_id, viewed_at)` index makes that scan direct.
5. **Rules the database enforces:**
   - Foreign keys and unique keys.
   - Format checks: site keys `ws_XXXXXX`, bare domains, `ISO-2` country codes, paths starting with `/`.
   - Cascades: removing a website removes its visits and page views.
   - `updated_at` maintained by a trigger.
6. **Privacy by design.**
   - No IP addresses, no full user agents, no cookies.
   - The visitor hash changes every day, and the salt behind it is deleted after 2 days.
7. **Security.**
   - Row level security is on for every table, with no policies.
   - Supabase's public `anon` / `authenticated` roles have no grants at all.
   - Only the API, with the secret service key, can read or write. It scopes every query to the signed-in user's workspace.

## Reading the data

Where did yesterday's page views on a site come from?

```sql
select c.label as channel,
       coalesce(v.source_detail, p.label) as platform,
       count(*) as page_views
from page_views pv
join visits v    on v.id = pv.visit_id
join platforms p on p.id = v.platform_id
join channels c  on c.id = v.channel_id
where pv.site_id = '<site id>'
  and pv.viewed_at >= date_trunc('day', now() at time zone 'Asia/Karachi') at time zone 'Asia/Karachi' - interval '1 day'
  and pv.viewed_at <  date_trunc('day', now() at time zone 'Asia/Karachi') at time zone 'Asia/Karachi'
group by 1, 2
order by 3 desc;
```

Visits per week in the workspace timezone (Postgres weeks start on Monday):

```sql
select date_trunc('week', started_at at time zone 'Asia/Karachi') as week, count(*) as visits
from visits
where site_id = '<site id>'
group by 1
order by 1;
```

## Growing the data (Phase 6)

- **Rollups:** when page views reach the millions, add daily summary tables, e.g. visits per site × day × channel × platform × device × country, filled by a cron job. Dashboards then read the summaries instead of raw rows. This is the standard next step for analytics and keeps the raw tables normalized.
- **Retention:** the weekly cron deletes raw visits and page views older than `workspaces.retention_months`. The BRIN index on `page_views.viewed_at` makes those deletes cheap. Monthly partitions are the next step if deletes ever get slow.

## Changing the schema

1. Add a **new** file in `supabase/migrations/` (e.g. `20261101000000_add_x.sql`). Never edit a migration that has run against data.
2. Add a description for each new table and column (`comment on …`) and keep RLS on.
3. Update `apps/api/src/db/database.types.ts`: run `npm run db:types`, or edit it by hand.
4. Update this page.

> The current migration replaced an earlier draft while the database was still empty. To bring a database built from the draft up to date, run [`supabase/scripts/reset_public_schema.sql`](../supabase/scripts/reset_public_schema.sql) first. It deletes all app tables.
