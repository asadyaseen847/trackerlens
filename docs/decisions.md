# Technical decisions

A short log of choices that aren't obvious from the code. Newest first.

## Template

```
## YYYY-MM-DD: Title
**Context:** what forced a decision.
**Decision:** what we chose.
**Why:** the main reason, and what we gave up.
```

---

## 2026-10-14: Product name TrackerLens

**Decision:** `BRAND_NAME = 'TrackerLens'` and `IGNORE_PARAM = 'trackerlens_ignore'` in `packages/shared/src/constants.ts`. The tracker gets the parameter at build time (`build.mjs` `define`).

## 2026-10-14: Tests run on PGlite (real Postgres in memory) instead of a hand-written fake

**Context:** Phases 2–3 put the core logic in SQL functions (atomic page-view recording, timezone bucketing, breakdowns), which a JavaScript fake can't run.
**Decision:**

- `apps/api/test/pgliteRepo.ts` runs every migration in PGlite. It builds the database once per test worker and clones it per test.
- The same setup powers `npm run dev:demo`, `npm run bench` and the end-to-end test.
- `@electric-sql/pglite` is a dev-only dependency; production never imports it.

**Why:** The tests exercise the real schema, constraints and SQL, including that stats match raw counts exactly, without needing a Supabase project in CI.

## 2026-10-14: Tracking and stats logic as Postgres functions

**Decision:**

- `record_page_view` does the whole visit step in one call (find or extend the visit, insert the page view, update the site's events) under `pg_advisory_xact_lock(site + visitor)`.
- Stats are `stats_*` functions. The period math lives in `packages/shared/src/periods.ts`. Buckets are matched by local start date (`YYYY-MM-DD`), the same key `to_char(date_trunc(unit, ts at time zone tz))` returns.

**Why:** One round trip per hit on serverless; no duplicate visits from two quick hits; DST-correct bucketing in SQL. The period math is unit-tested, including 23/25-hour days and year boundaries.

## 2026-10-14: Unknown sources are platform "other" + source_detail

**Decision:** `classify()` returns a known platform id or `other`. For `other`, the referring host or raw `utm_source` goes in `sourceDetail` (`visits.source_detail`), and breakdowns show that text as the platform name.
**Why:** It keeps `visits.platform_id` a foreign key to `platforms` (normalized schema) while still showing "news.ycombinator.com". This deviates from §8's "platform = referrer host".

## 2026-10-14: Collect endpoint details

**Decision:**

- Mounted at `/api/e` before `express.json()`, with its own `text/plain` parser (2 KB) and error handler that always answers 202.
- The work runs before the response, because a Vercel function can freeze after it responds.
- The site cache (60 s) and the daily salt are memoized per function instance.
- The IP is read from `x-forwarded-for` / `x-real-ip` and used only for the hash.

## 2026-10-14: Unique visitors and repeat visits

**Decision:** "Unique visitors" is `count(distinct visitor_hash)` in the range, as §9 defines. Because the hash changes daily, a person counts once per day. The KPI tile explains this in an info tooltip.

## 2026-10-14: Social (Phase 4)

**Decision:**

- Tokens use AES-256-GCM: `v1.<iv>.<tag>.<ciphertext>`, a random 12-byte IV, and the key from `ENCRYPTION_KEY`. There's a fixed dev key outside production.
- The OAuth `state` is a 10-minute HS256 JWT bound to workspace, user and platform.
- The mock provider's callback URL is relative, so sample data works before `APP_URL` is set.
- The first sync backfills 548 days for the mock and 90 days for real providers; later syncs fetch from the last sync to yesterday (UTC).
- "Visits to your websites" for a platform is the website visits whose `platform_id` matches.

**Deviation from the prototype:** the prototype makes every Connect button and the "Best" badge lime. §12 rule 1 allows one lime element per screen (the Followers tile), so Connect buttons are dark and Best uses the track color.

## 2026-10-14: Phase 6 operations

**Decision:**

- Logs are one JSON line per event. When `ERROR_WEBHOOK_URL` is set, errors are also posted there (Slack/Discord, fire-and-forget). Nothing paid.
- The retention cron runs weekly (Monday 03:30 UTC). The Hobby plan allows 100 cron jobs, each at most daily.
- Rate limiting: the in-memory limiter stays as a safety net; Vercel Firewall rules are the real limit (README).

## 2026-10-13: Normalized database schema (replaces the first draft)

**Context:** The owner asked for the best-structured, easy-to-understand database. The first draft translated the brief's MongoDB model directly: page views copied channel/platform/country/device, platform was free text, and the table was named `sessions`.
**Decision:** The schema is rewritten in third normal form, still in one migration file (the database was empty):

- `sessions` becomes `visits`, matching the product's wording; `pageviews` becomes `page_views`.
- Lookup tables: `channels` and `platforms` (each platform has a channel), seeded in the migration.
  - `visits.platform_id` and `channel_id` are foreign keys.
  - Unknown sources use platform `other`, with the host or utm_source in `visits.source_detail`.
- `page_views` keeps only `visit_id`, `site_id`, `viewed_at` and `path`. Source, device and country are read from the visit with a join.
- Kept deliberately:
  - `page_views.site_id`, because every scan is per site and time range.
  - `visits.channel_id`, because campaign tags can override the platform's channel.
- OAuth tokens move to `social_account_tokens` (1:1), away from profile data.
- Integrity rules: check constraints (site key, domain, country code, path, counts), an `updated_at` trigger, and cascades.
- Every table and column has a `comment`, shown in Supabase's Table Editor. `docs/database.md` has the diagram.
- Supabase's `anon` / `authenticated` roles get no grants, on top of RLS.

**Why:** Each fact is stored once and explains itself, and bad data is rejected by the database. This deviates from §7.10 (copying visit fields onto page views for speed). The scalable fix for speed is daily rollup tables, planned in Phase 6 (§17), not duplicated columns.
**How it was applied:** A database built from the draft runs `supabase/scripts/reset_public_schema.sql` (it drops the empty draft tables), then the migration.

## 2026-10-13: Phase 1, API data access goes through a `Repo` interface

**Decision:** Services and routes use `Repo` (`apps/api/src/db/repo.ts`). Production uses `supabaseRepo()`, and tests pass an in-memory `memoryRepo()` to `createApp({ repo })`. The in-memory version copies the constraints that matter: unique email, unique site key, unique domain per workspace, and cascading deletes.
**Why:** Auth, CRUD and workspace-isolation tests run in CI without a database or network. The trade-off is that SQL behaviour is verified by a manual browser run against Supabase, not by unit tests.

## 2026-10-13: Phase 1, sign-up without a transaction

**Decision:** Sign-up inserts the user, then the workspace, then the membership. If a later insert fails, it deletes the earlier rows.
**Why:** supabase-js has no transactions over REST. A Postgres function would make it atomic but needs another migration. Revisit if partial accounts ever appear.

## 2026-10-13: Phase 1, session cookie and auth details

**Decision:**

- Cookie `session`: an HS256 JWT (`sub` = user id), valid 30 days. `httpOnly`, `SameSite=Lax`, and `Secure` in production.
- bcrypt cost 12; tests use 4.
- Wrong email and wrong password return the same 401. Unknown emails are compared against a dummy hash, so the timing matches too.
- Login and sign-up allow 10 attempts per minute per client. The in-memory limiter keys clients by an IP hash, never the IP itself.
- Development without `JWT_SECRET` uses a fixed, insecure dev secret. Production refuses to start without one.

## 2026-10-13: Phase 1, the dashboard builds the snippet from its own origin

**Decision:** The Install page builds the code with `buildSnippet(site, trackerScriptUrl(window.location.origin))`. `GET /sites/:id/snippet` still exists and uses `APP_URL`.
**Why:** The script is served by the same web app that shows the code, so the URL is right locally, on `.vercel.app` and on a custom domain, even before `APP_URL` is set.

## 2026-10-13: Phase 1, "ignore my visits" parameter

**Decision:** `?trackerlens_ignore=1`, from `IGNORE_PARAM` in `packages/shared/src/constants.ts`, alongside `BRAND_NAME` ("TrackerLens"). The tracker imports the same constant.

## 2026-10-13: `src/app.ts` renamed to `src/createApp.ts`

**Context:** The first working build crashed on every request: `Invalid export found in module ".../src/app.js". The default export must be a function or server`. Vercel's Express preset uses the first file it finds among `src/app`, `src/index` and `src/server`, and `app.ts` only exported `createApp`.
**Decision:** The app factory lives in `src/createApp.ts`. `src/index.ts` is the only entrypoint and default-exports the app. Vercel also requires the entrypoint's source to import `express`: the next build failed with "No entrypoint found which imports express". So `src/index.ts` imports the `Express` type, which is erased at runtime. `test/entrypoint.test.ts` enforces both rules.
**Why:** The entrypoint is then unambiguous, with no extra config. This deviates from the scaffold layout's file name.

## 2026-10-13: API runs in Vercel region `icn1` (Seoul)

**Decision:** `apps/api/vercel.json` sets `"regions": ["icn1"]`, matching the Supabase project in `ap-northeast-2` (Seoul).
**Why:** Every API request makes several database calls; same-region keeps each one fast. Change both together if the database ever moves.

## 2026-10-13: helmet import that works under both of its type declarations

**Context:** The first Vercel deploy failed its typecheck with `TS2349` at `app.use(helmet())`. Vercel's build typecheck resolved helmet's CommonJS declaration (`index.d.cts`), where an ES module's default import is the module object rather than the function. Our local `tsc` resolves `index.d.mts`, so it passed locally.
**Decision:** `apps/api/src/createApp.ts` accepts either shape at runtime and in types. A test checks helmet's headers are still sent.
**Why:** The fix works no matter which declaration a tool picks. Watch for the same issue with other dual ESM/CJS packages (default imports).

## 2026-10-13: Supabase Postgres instead of MongoDB

**Context:** The brief (§2, §4, §5) specifies MongoDB Atlas with Mongoose. The owner decided to use **Supabase**, connected to Vercel and GitHub through their integrations. `BUILD_PROMPT.md` isn't edited, so this entry overrides those sections.
**Decision:**

- Postgres schema in `supabase/migrations/`, a direct translation of §5.
- ObjectIds become `uuid`s; snake_case columns.
- Site settings and UTM fields become flat columns.
- Workspace members get their own `workspace_members` table.
- The page-view time-series collection becomes the `page_views` table. The final shape is in the normalized schema entry above.
- `$dateTrunc` becomes `date_trunc(unit, viewed_at at time zone tz)`, inside Postgres functions called with `db.rpc` (Phase 3).
- Env vars: `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` replace `MONGODB_URI`.

**Why:** The owner's choice of platform. Postgres also handles the grouped stats queries well.

## 2026-10-13: Database access via supabase-js with the service-role key; RLS on, no policies

**Context:** Choice between supabase-js, Drizzle and Prisma. The owner chose supabase-js.
**Decision:** The API creates one cached service-role client (`apps/api/src/db/supabase.ts`). RLS is enabled on every table with no policies, so the anon key gets nothing. Workspace scoping is enforced in API code and covered by tests (§10, §14). Aggregations that the query builder can't express are Postgres functions in migrations. `database.types.ts` was hand-written for the scaffold; regenerate it with `npm run db:types` once the project exists.
**Why:** It needs no direct Postgres connection, so there are no pooler or connection-limit concerns on Vercel. The trade-off: complex queries live in SQL functions, not TypeScript.

## 2026-10-13: Own email + password auth, not Supabase Auth

**Decision:** Keep §10 as written. Users live in `public.users` with a bcrypt hash, and the API issues its own JWT in an httpOnly cookie. Supabase Auth (`auth.users`) is unused.
**Why:** The owner's choice. It keeps the brief's same-site cookie design. Supabase Auth remains an option if Google sign-in or password reset is wanted later.

## 2026-10-13: Pin TypeScript 6.0 and ESLint 9

**Context:** The latest TypeScript is 7.0 and the latest ESLint is 10. `typescript-eslint` supports TypeScript `<6.1`, and `eslint-plugin-react` and `eslint-plugin-jsx-a11y` support ESLint up to 9.
**Decision:** Pin `typescript@6.0.3`, `eslint@9.39.5` and `@eslint/js@9.39.5`. Everything else is on its latest version.
**Why:** Lint has to pass in CI. Upgrade once the plugins support the new versions.

## 2026-10-13: Lockfile generated with npm 11

**Context:** On npm 10.9 (bundled with Node 22), `npm install` without a lockfile crashes with `Cannot read properties of null (reading 'edgesOut')`. This is an arborist bug that walks optional peer dependencies (vitest's browser peers).
**Decision:** The committed `package-lock.json` was created with `npx npm@11 install`. With the lockfile present, npm 10 `install` and `ci` work normally.
**Why:** CI and Vercel keep the Node 22 default npm, and only lockfile regeneration needs npm 11.

## 2026-10-13: `ignoreDeprecations: "6.0"` for tsup's type build only

**Context:** tsup's `.d.ts` step sets `baseUrl` internally, and TypeScript 6 now rejects it as deprecated.
**Decision:** Pass `ignoreDeprecations: '6.0'` to the dts compiler options in `packages/shared/tsup.config.ts`. Our own tsconfigs don't use `baseUrl`.
**Why:** It's the smallest fix. Revisit when tsup or TypeScript changes.

## 2026-10-13: `packages/shared` is built to `dist/` and built on install

**Context:** Vercel deploys `apps/web` and `apps/api` as separate projects that need the shared code compiled.
**Decision:** `tsup` builds ESM and `.d.ts` files to `packages/shared/dist`. A root `postinstall` builds it, and `npm run dev` runs `tsup --watch` alongside the apps.
**Why:** Both apps import plain JS and types, with no TS path aliases, so they behave the same locally, in CI and on Vercel.

## 2026-10-13: Placeholder API routes answer 501, and `requireAuth` refuses until Phase 1

**Decision:** Every route except `/api/health` returns `501 { error: "Not implemented", phase }`. The `requireAuth` stub fails closed (501) instead of passing through.
**Why:** No endpoint can be left unprotected by accident while phases are built.

## 2026-10-13: Validated values go to `res.locals`

**Decision:** The `validate()` middleware writes the parsed body, query and params to `res.locals`.
**Why:** `req.query` is a read-only getter in Express 5.

## 2026-10-13: Data retention lives on the workspace

**Decision:** `workspaces.retention_months` (default 25). The Phase 6 weekly cron enforces it.
**Why:** §5 asks for a configurable setting, and the workspace is the natural place for it.

## 2026-10-14: Dashboard numbers come from daily rollups

**Decision:** Four summary tables are updated with every tracked hit, inside `record_page_view`:

- `daily_totals`: per site, local day, channel and device;
- `daily_stats`: the same, plus platform, source detail, campaign and country;
- `daily_page_totals`: per site, local day and page;
- `daily_page_stats`: the same, plus the visit's channel, device and country.

All KPIs, charts, lists and site cards read them, each query from the smallest table that can answer it (see `docs/database.md`). Only "on the site right now" reads `visits`.

- `rebuild_daily_stats()` recreates all four from the raw rows. It runs after bulk imports and when a workspace changes its timezone.
- Every period is whole local days: "vs before" is the same number of whole days, weeks or months.

**Why:** §17 asks for stats under 500 ms on 1M page views. Raw scans took 0.5–2.7 s in `npm run bench`.

- Small tables are needed because one detailed table barely compresses spread-out traffic: the demo has about 130 kinds of visit per site per day.
- Updating the rollups in the same transaction, rather than by cron, keeps the numbers live and exact.

**Visitors** are counted once per day, because the visitor hash changes daily. Each visitor counts under their first visit of the day, so filtered visitor counts mean "people whose first visit of the day matched the filter".
