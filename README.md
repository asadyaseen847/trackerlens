# TrackerLens

Privacy-friendly traffic analytics: how many people visit your websites, and which platform sent them (Google, Instagram, TikTok, ChatGPT, a newsletter…). It also compares your social media audiences with the visits each platform sends.

- **Websites:** add a domain, paste one line of code, and see visits, visitors, page views, the live count, a stacked chart per channel, and platforms, pages, campaigns, countries and devices.
  - Views can be daily, weekly, monthly or yearly, each compared with the period before.
- **Social media:** connect Instagram, Facebook, YouTube, LinkedIn, TikTok and X to compare followers and post views with the website visits each one sends.
  - Sample data is used until real logins are approved (see Phase 5).
- **Install code:** the snippet, paste guides for 6 website builders, "Check installation", site settings and a trackable-link builder.

The spec is [`docs/BUILD_PROMPT.md`](docs/BUILD_PROMPT.md) and the design reference is [`docs/design/prototype.html`](docs/design/prototype.html). Decisions are logged in [`docs/decisions.md`](docs/decisions.md) and the database is explained in [`docs/database.md`](docs/database.md).

## Status

| Phase                                                                                    | State                                                                                                                           |
| ---------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| 0. Setup                                                                                 | ✅                                                                                                                              |
| 1. Accounts & sites                                                                      | ✅                                                                                                                              |
| 2. Tracking (script, collect, classification, sessions, Check installation, e2e)         | ✅                                                                                                                              |
| 3. Websites dashboard (stats API, CSV, seed, full page)                                  | ✅                                                                                                                              |
| 4. Social with sample data (provider interface, mock, sync cron, Social page)            | ✅                                                                                                                              |
| 5. Real social providers                                                                 | ⏸️ Needs the owner: developer apps, credentials and platform review. See [`docs/social-providers.md`](docs/social-providers.md) |
| 6. Hardening & launch (retention, privacy page, monitoring hook, performance, checklist) | ✅ code done; see the launch checklist below                                                                                    |

## Try it in 1 minute (no database needed)

```bash
npm install
npm run dev:demo
```

Open http://localhost:5173 and log in as **demo@example.com / demo1234**.

This runs the real API on an in-memory Postgres (PGlite) with every migration applied. It is filled with about 18 months of deterministic demo traffic and sample social accounts. Nothing is saved when you stop it.

## Run locally against Supabase

```bash
npm install                                   # also builds packages/shared
cp apps/api/.env.example apps/api/.env        # then set SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY
npm run dev
```

- Dashboard: http://localhost:5173
- API: http://localhost:4000. The dashboard proxies `/api` to it.

In development the API needs only `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`. In production `JWT_SECRET`, `ENCRYPTION_KEY` and `CRON_SECRET` are also required, and `APP_URL` is needed for real social logins. The API exits with a clear message if a required variable is missing.

To see the tracker work end to end, run `npm run test:e2e`, or open `examples/test-site/` through a static server.

## Scripts (run from the root)

| Script                            | What it does                                                                                                   |
| --------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| `npm run dev`                     | Shared (`tsup --watch`) + API (`tsx watch`, :4000) + web (Vite, :5173), against Supabase                       |
| `npm run dev:demo`                | Same dashboard, with the API on an in-memory Postgres full of demo data                                        |
| `npm run build`                   | Builds shared → tracker → web → API (typecheck)                                                                |
| `npm run build:tracker`           | Bundles the tracker into `apps/web/public/js/script.js`; fails above 1.5 KB gzipped (it's ~0.8 KB)             |
| `npm run typecheck`               | `tsc` in every workspace, plus `scripts/` and `e2e/`                                                           |
| `npm run lint`                    | ESLint (typescript-eslint, react, react-hooks, jsx-a11y), zero warnings allowed                                |
| `npm run format` / `format:check` | Prettier                                                                                                       |
| `npm test`                        | Unit tests (shared) and API tests. The API tests run on an in-memory Postgres with the real migrations         |
| `npm run test:e2e`                | Playwright smoke test: tracker → collect → database → dashboard. First time: `npx playwright install chromium` |
| `npm run bench`                   | Performance check: stats queries on ~1M page views (target < 500 ms)                                           |
| `npm run seed -- --yes`           | Adds the demo account, 3 sites and ~130k visits to the Supabase in `apps/api/.env`                             |
| `npm run db:types`                | Regenerates `apps/api/src/db/database.types.ts` from the linked Supabase project                               |

## Environment variables

Each app has a commented `.env.example`:

- [`apps/api/.env.example`](apps/api/.env.example) covers:
  - `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `JWT_SECRET`, `ENCRYPTION_KEY`, `APP_URL`, `CRON_SECRET`
  - `SOCIAL_MOCK`
  - optional `ERROR_WEBHOOK_URL`
  - the OAuth credentials for Meta, Google/YouTube, LinkedIn, TikTok and X
- [`apps/web/.env.example`](apps/web/.env.example) covers `VITE_API_URL` and `TRACKER_API_URL` (used when building the tracker).

Never commit real `.env` files. They are gitignored.

## Database (Supabase)

The database is **Supabase Postgres**. The API talks to it with `@supabase/supabase-js`, server-side only, using the service-role key. Login is our own (email + password, JWT cookie), not Supabase Auth.

- **Schema:** [`supabase/migrations/`](supabase/migrations), explained with a diagram in [`docs/database.md`](docs/database.md).
  - It's in third normal form, with lookup tables for channels and platforms.
  - Every table and column has a description.
  - Row level security is on everywhere, and the public keys have no access at all.
- **Functions:** recording a page view and every stats query are Postgres functions, called with `rpc()`. Each is one round trip, and recording a page view is atomic.
- **Applying migrations:** run each file in `supabase/migrations/` in order, in the Supabase SQL editor (or `npx supabase db push`).
  - A database built from the first draft needs [`supabase/scripts/reset_public_schema.sql`](supabase/scripts/reset_public_schema.sql) first. It deletes all app tables, so only use it while there's no real data.
- **Vercel integration:** connect the Supabase project to the **API** Vercel project only. The web project must never get `SUPABASE_SERVICE_ROLE_KEY`.

## How it fits together

```
visitor's browser ──(script.js, 0.8 KB)──► POST /api/e ──► record_page_view() ──► visits + page_views
                                                │  site cache, hostname check, bots dropped,
                                                │  daily-salted hash (IP never stored)
dashboard (apps/web) ──/api rewrite──► API (apps/api, Express on Vercel) ──rpc──► Supabase Postgres
                                                ▲
Vercel Cron ──Bearer CRON_SECRET──► /api/cron/{cleanup-salts, social-sync, retention}
```

| Area                                        | Code                                                                                 |
| ------------------------------------------- | ------------------------------------------------------------------------------------ |
| Tracker                                     | `packages/tracker/`                                                                  |
| Classification, periods, schemas, constants | `packages/shared/src/`                                                               |
| API routes                                  | `apps/api/src/routes/`: auth, workspace, sites, collect, stats, social, cron, health |
| Business logic                              | `apps/api/src/services/`                                                             |
| Database access                             | `apps/api/src/db/`: the `Repo` interface; Supabase in production, PGlite in tests    |
| Social providers                            | `apps/api/src/social/`: mock provider, AES-GCM token crypto, daily sync              |
| Dashboard                                   | `apps/web/src/features/`: websites, social, install, auth, onboarding, settings      |
| SQL                                         | `supabase/migrations/`                                                               |
| Demo data                                   | `scripts/demo/generate.ts`, used by `seed`, `dev:demo`, `bench` and the API tests    |

## Deploying to Vercel

Two Vercel projects from the same repo. Both install from the repo root (npm workspaces).

### Project 1: web (dashboard + tracker script)

- **Root Directory:** `apps/web`
- **Framework preset:** Vite
- **Build Command:** `cd ../.. && npm run build -w @audience/shared && npm run build:tracker && npm run build -w @audience/web`
- **Output Directory:** `dist`
- **Env vars:** `VITE_API_URL=/api` and `TRACKER_API_URL=https://<api domain>/api/e`
- `vercel.json`:
  - adds the SPA fallback;
  - rewrites `/api/*` to the API project, so the login cookie stays first-party;
  - serves `/js/script.js` with CORS and caching.

### Project 2: API

- **Root Directory:** `apps/api`
- **Framework preset:** Express (`src/index.ts` default-exports the app and imports `express`, as Vercel requires)
- **Build Command:** `cd ../.. && npm run build -w @audience/shared`
- **Region:** `icn1` (Seoul), set in `vercel.json` to match the Supabase region
- **Env vars:** everything in `apps/api/.env.example`, with `NODE_ENV=production` and `SOCIAL_MOCK=true` until real providers exist
- **Crons** (`vercel.json`; Hobby allows one run per day per job):
  - `cleanup-salts`: daily
  - `social-sync`: daily
  - `retention`: weekly

### Rate limiting (Vercel Firewall)

The API has an in-memory per-client limit as a safety net: 10 logins/sign-ups and 300 tracker hits per minute. It keys clients by an IP hash and never stores the IP. Each function instance counts separately, so add Firewall rules in Vercel → the API project → **Firewall**:

1. **Rate limit `/api/auth/*`:** about 20 requests per minute per IP → deny (429).
2. **Rate limit `/api/e`:** about 600 requests per minute per IP → deny. Real visitors send a few per minute.
3. Optional: block traffic from countries you never serve.

## Launch checklist

- [ ] Supabase: run every file in `supabase/migrations/` in order. The Table Editor should show 12 tables; `channels` has 6 rows and `platforms` has 31.
- [ ] API env vars: `NODE_ENV=production`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `JWT_SECRET`, `ENCRYPTION_KEY` (32 bytes, base64), `CRON_SECRET`, `APP_URL=https://<web domain>`, `SOCIAL_MOCK=true`. Then redeploy.
- [ ] Web env vars: `VITE_API_URL=/api` and `TRACKER_API_URL=https://<api domain>/api/e`. Then redeploy.
- [ ] `apps/web/vercel.json`: the `/api` rewrite points at the API domain.
- [ ] Checks:
  - `https://<api>/api/health/db` → `{"db":"connected"}`
  - `https://<web>/api/health` → ok
  - `https://<web>/js/script.js` loads
- [ ] Sign up on the live site, add a website, paste the code, open the site, then "Check installation" → ✓ Working.
- [ ] Vercel → API project → **Cron Jobs**: three jobs listed. Trigger `cleanup-salts` once and check the logs.
- [ ] Vercel Firewall rules (above).
- [ ] Optional: `ERROR_WEBHOOK_URL` (Slack or Discord) for error alerts.
- [ ] Optional: a custom domain. Update `APP_URL`, `TRACKER_API_URL` and the `vercel.json` rewrite.
- [ ] Phase 5, when ready: real social providers (see [`docs/social-providers.md`](docs/social-providers.md)), then `SOCIAL_MOCK=false`.

## Performance

`npm run bench` loads about 1M page views (455k visits) into an in-memory Postgres and times every dashboard query. Last run, 2026-10-14:

| Query                             |        Time |
| --------------------------------- | ----------: |
| Overview daily / weekly / monthly |    16–80 ms |
| Overview yearly                   |      191 ms |
| Overview, 1 site + 3 filters      |      138 ms |
| Platforms list, 12 months         |      261 ms |
| Pages list (no filter / phones)   | 19 / 187 ms |
| Campaigns list, this year         |      108 ms |
| Countries list, 12 months         |      183 ms |
| Live                              |        3 ms |

Every query is under the 500 ms target because they read daily rollup tables (see [`docs/database.md`](docs/database.md#rollups-phase-6)). Supabase's Postgres is faster than the in-memory WebAssembly one, so these numbers are an upper bound.

## CI

`.github/workflows/ci.yml` runs on every push and PR:

1. `npm ci` → typecheck → lint → unit + API tests → tracker size check.
2. The Playwright smoke test.

> **npm note:** on npm 10.9, adding or removing a dependency, or installing without `package-lock.json`, crashes (an arborist bug). Use `npx npm@11 install <pkg> -w <workspace>` for those. Plain `npm install` / `npm ci` with the lockfile work on npm 10.
