# [YOUR BRAND] Audience Tracker

Privacy-friendly traffic analytics: how many people visit your websites, and which platform sent them (Google, Instagram, TikTok, ChatGPT, a newsletter…). It also compares your social media audiences with the visits each platform sends.

The full spec is in [`docs/BUILD_PROMPT.md`](docs/BUILD_PROMPT.md), and the design reference is [`docs/design/prototype.html`](docs/design/prototype.html). Technical decisions are logged in [`docs/decisions.md`](docs/decisions.md).

> **Status:** scaffold only (Phase 0). Pages are placeholders, and API routes other than `/api/health` answer `501`.

## Prerequisites

- **Node 22 LTS** (`nvm use` reads `.nvmrc`). npm 10+ comes with it.
- A **MongoDB Atlas** connection string. Pick a region close to your Vercel function region.

## Run locally

```bash
npm install                                   # also builds packages/shared
cp apps/api/.env.example apps/api/.env        # then set MONGODB_URI
npm run dev
```

- Dashboard: http://localhost:5173
- API: http://localhost:4000 (the dashboard proxies `/api` to it, so http://localhost:5173/api/health works)

In development the API needs only `MONGODB_URI`. It exits with a clear message if that's missing. In production `JWT_SECRET`, `ENCRYPTION_KEY`, `APP_URL` and `CRON_SECRET` are also required.

To try the tracker locally, run `npm run build:tracker`, then open `examples/test-site/index.html` through any static server (for example `npx serve examples/test-site`).

## Scripts (run from the root)

| Script                            | What it does                                                                                                           |
| --------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `npm run dev`                     | Runs three things together: shared (`tsup --watch`), API (`tsx watch`, port 4000) and web (Vite, port 5173)            |
| `npm run build`                   | Builds shared → tracker → web → API (typecheck)                                                                        |
| `npm run build:tracker`           | Bundles `packages/tracker` into `apps/web/public/js/script.js`, prints its gzipped size, and fails if it's over 1.5 KB |
| `npm run typecheck`               | `tsc` in every workspace, plus `scripts/` and `e2e/`                                                                   |
| `npm run lint`                    | ESLint (typescript-eslint, react, react-hooks, jsx-a11y), with zero warnings allowed                                   |
| `npm run format` / `format:check` | Prettier                                                                                                               |
| `npm test`                        | Vitest in every workspace (API tests use Supertest)                                                                    |
| `npm run test:e2e`                | Playwright smoke test. The first time, run `npx playwright install chromium`                                           |
| `npm run seed`                    | Fills MongoDB with demo data (Phase 3). Reads `apps/api/.env`                                                          |

## Environment variables

Each app has a commented `.env.example`:

- [`apps/api/.env.example`](apps/api/.env.example): `MONGODB_URI`, `JWT_SECRET`, `ENCRYPTION_KEY`, `APP_URL`, `CRON_SECRET`, `SOCIAL_MOCK`, and the OAuth credentials for Meta, Google/YouTube, LinkedIn, TikTok and X
- [`apps/web/.env.example`](apps/web/.env.example): `VITE_API_URL`, and `TRACKER_API_URL` (used when building the tracker)

Never commit real `.env` files. They are gitignored.

## Where each phase's work lives

| Phase                    | Main locations                                                                                                                                                                                                                                                    |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0. Setup                 | Everything in this scaffold                                                                                                                                                                                                                                       |
| 1. Accounts & sites      | `apps/api/src/routes/{auth,workspace,sites}.ts`, `services/{auth,sites}.service.ts`, `middleware/{requireAuth,rateLimit}.ts`; `packages/shared/src/{domain,snippet,schemas}.ts`; `apps/web/src/features/{auth,onboarding,install,settings}/`, `AddSiteDialog.tsx` |
| 2. Tracking              | `packages/tracker/`; `apps/api/src/routes/collect.ts`, `services/{collect,salt,session}.service.ts`, `utils/{hash,ua}.ts`, `middleware/collectCors.ts`; `packages/shared/src/classify.ts`; `examples/test-site/`; `e2e/`                                          |
| 3. Websites dashboard    | `apps/api/src/routes/stats.ts`, `services/{stats,csv}.service.ts`; `packages/shared/src/periods.ts`; `apps/web/src/features/websites/`, `components/{charts,breakdown}/`, `lib/{format,urlState}.ts`; `scripts/seed.ts`                                           |
| 4. Social (mock)         | `apps/api/src/social/` (provider, registry, crypto, sync, `providers/mock.ts`), `routes/social.ts`; `apps/web/src/features/social/`                                                                                                                               |
| 5. Real social providers | `apps/api/src/social/providers/{meta,youtube,linkedin,tiktok,x}.ts`                                                                                                                                                                                               |
| 6. Hardening & launch    | `routes/cron.ts` (retention), `apps/web/src/pages/PrivacyPage.tsx`, Vercel setup, monitoring hook in `utils/logger.ts`                                                                                                                                            |

Search for `TODO(Phase N` to find every stub for a phase.

## Deploying to Vercel

This repo deploys as **two Vercel projects** from the same Git repo. Both install from the repo root, because npm workspaces need it.

### How the shared package gets built

`apps/web` and `apps/api` import `@audience/shared` from `packages/shared/dist`, which is compiled by `tsup`. The root `postinstall` script builds it, so it's ready right after `npm install` on Vercel. The build commands below also rebuild it explicitly, before anything that depends on it.

### Project 1: web (dashboard + tracker script)

- **Root Directory:** `apps/web`
- **Framework preset:** Vite
- **Install Command:** default (Vercel detects npm workspaces and installs from the repo root)
- **Build Command:** `cd ../.. && npm run build -w @audience/shared && npm run build:tracker && npm run build -w @audience/web`
- **Output Directory:** `dist`
- **Env vars:** `VITE_API_URL=/api`, `TRACKER_API_URL=https://api.[APP_DOMAIN]/api/e`
- `vercel.json` serves the SPA fallback and rewrites `/api/*` to the API project, so the login cookie stays first-party. Replace `[APP_DOMAIN]` there.
- The tracker is served at `https://[APP_DOMAIN]/js/script.js`.

### Project 2: API

- **Root Directory:** `apps/api`
- **Framework preset:** Express (zero-config: `src/index.ts` default-exports the app)
- **Install Command:** default (Vercel detects npm workspaces and installs from the repo root)
- **Build Command:** `cd ../.. && npm run build -w @audience/shared`
- **Domain:** `api.[APP_DOMAIN]`
- **Env vars:** everything in `apps/api/.env.example`, with `NODE_ENV=production`
- `vercel.json` defines the Cron Jobs (`/api/cron/cleanup-salts` and `/api/cron/social-sync`, daily). Vercel sends `Authorization: Bearer $CRON_SECRET`.
- MongoDB Atlas network access must allow Vercel (0.0.0.0/0 with a strong password, or the Vercel ↔ Atlas integration).

The full launch checklist arrives in Phase 6.

## CI

`.github/workflows/ci.yml` runs on every push and PR, in this order: `npm ci` → typecheck → lint → test → `build:tracker` (fails if the tracker is over 1.5 KB gzipped).

> **npm note:** a fresh `npm install` with **no** `package-lock.json` crashes on npm 10.9 (an arborist peer-dependency bug). The committed lockfile avoids it. If you ever delete the lockfile, regenerate it with `npx npm@11 install`.
