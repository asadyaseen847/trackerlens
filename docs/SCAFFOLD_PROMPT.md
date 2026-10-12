# Scaffold prompt: set up the project structure (do this first)

Create the complete folder structure, config files and starter files for a new project. **Don't build any features yet.** The features will come later from `docs/BUILD_PROMPT.md` (already in this folder). Read that file first so names, folders and tools match it exactly.

When you're done, the project must install, run, typecheck, lint and test cleanly, with empty placeholder screens and endpoints.

## Rules

- TypeScript everywhere with `strict: true`. ES modules (`"type": "module"`) in every package.
- Use **npm workspaces**. Use the latest stable version of each tool. Target Node **22 LTS**, and add an `.nvmrc` with `22`.
- Package scope: `@audience/*`. I'll rename it later.
- Wherever there's a stub, leave a comment like `// TODO(Phase 2, §7): collect endpoint` that points to the phase and section in `docs/BUILD_PROMPT.md`.
- Don't invent business logic. Stubs return placeholder values, or `501 Not Implemented` for API routes.
- Don't change `docs/BUILD_PROMPT.md` or `docs/design/prototype.html`.
- Before installing anything, show me the list of dependencies you'll add, grouped by package, and wait for my OK.

## Folder structure to create

```
/
├─ CLAUDE.md                     # short rules for future Claude sessions (see below)
├─ README.md                     # setup, scripts, env vars, deploy notes
├─ package.json                  # workspaces + root scripts
├─ tsconfig.base.json            # shared strict TS settings
├─ eslint.config.js              # flat config: typescript-eslint, react, react-hooks, jsx-a11y
├─ .prettierrc  .prettierignore  .editorconfig  .gitignore  .nvmrc
├─ .github/workflows/ci.yml      # install → typecheck → lint → test → build:tracker (size check)
├─ docs/
│  ├─ BUILD_PROMPT.md            # (exists)
│  ├─ design/prototype.html      # (exists)
│  └─ decisions.md               # log of technical decisions, starts empty with a template
├─ apps/
│  ├─ web/                       # Vite + React + TS dashboard
│  │  ├─ index.html              # Google Fonts link: Unbounded 600–800, Bricolage Grotesque 400–800
│  │  ├─ vite.config.ts          # React plugin; dev proxy /api → http://localhost:4000
│  │  ├─ vercel.json             # SPA fallback to index.html + rewrite /api/(.*) → https://api.[APP_DOMAIN]/api/$1
│  │  ├─ tsconfig.json  package.json  .env.example
│  │  ├─ public/
│  │  │  ├─ favicon.svg
│  │  │  └─ js/.gitkeep          # tracker build output goes here (script.js is gitignored)
│  │  └─ src/
│  │     ├─ main.tsx             # React root, QueryClientProvider, RouterProvider
│  │     ├─ router.tsx           # routes from BUILD_PROMPT §11
│  │     ├─ styles/
│  │     │  ├─ tokens.css        # COPY the :root block and both dark-mode blocks from docs/design/prototype.html
│  │     │  └─ global.css        # reset, body, focus ring, .sr-only, reduced-motion
│  │     ├─ lib/
│  │     │  ├─ api.ts            # fetch wrapper (credentials: 'include', JSON, typed errors)
│  │     │  ├─ queryClient.ts
│  │     │  ├─ format.ts         # number/percent/date formatters (stubs)
│  │     │  └─ urlState.ts       # read/write filters in the query string (stub)
│  │     ├─ components/
│  │     │  ├─ layout/AppShell.tsx  TopBar.tsx  Tabs.tsx      (+ .module.css)
│  │     │  ├─ ui/Button.tsx  Chip.tsx  SegmentedControl.tsx  Select.tsx  Switch.tsx
│  │     │  │     Dialog.tsx  Toast.tsx  Tile.tsx  Panel.tsx  StatusChip.tsx  DeltaChip.tsx
│  │     │  │     CodeBox.tsx  EmptyState.tsx  Skeleton.tsx          (+ .module.css each)
│  │     │  ├─ charts/StackedBarChart.tsx  Sparkline.tsx  ChartTable.tsx
│  │     │  └─ breakdown/BreakdownPanel.tsx  BreakdownRow.tsx
│  │     ├─ features/
│  │     │  ├─ auth/LoginPage.tsx  SignupPage.tsx  useAuth.ts
│  │     │  ├─ onboarding/OnboardingPage.tsx
│  │     │  ├─ websites/WebsitesPage.tsx  SiteCards.tsx  FilterBar.tsx  KpiRow.tsx
│  │     │  │            Insight.tsx  LiveCounter.tsx  AddSiteDialog.tsx  queries.ts
│  │     │  ├─ social/SocialPage.tsx  SocialCards.tsx  ViewsToVisitsTable.tsx  queries.ts
│  │     │  ├─ install/InstallPage.tsx  SnippetBox.tsx  BuilderGuides.tsx
│  │     │  │          SiteSettings.tsx  LinkBuilder.tsx  WhatWeCollect.tsx
│  │     │  └─ settings/SettingsPage.tsx
│  │     └─ pages/NotFoundPage.tsx  PrivacyPage.tsx
│  └─ api/                       # Express + TS (Vercel zero-config: src/index.ts default-exports the app)
│     ├─ vercel.json             # crons: /api/cron/cleanup-salts (daily), /api/cron/social-sync (daily)
│     ├─ tsconfig.json  package.json  .env.example
│     ├─ src/
│     │  ├─ index.ts             # export default app; app.listen(4000) only when not on Vercel
│     │  ├─ app.ts               # builds the Express app: helmet, json, routes, 404, error handler
│     │  ├─ config/env.ts        # parse process.env with zod (all vars from BUILD_PROMPT §16)
│     │  ├─ db/mongo.ts          # cached Mongoose connection on globalThis
│     │  ├─ models/User.ts  Workspace.ts  Site.ts  Salt.ts  Session.ts  Pageview.ts
│     │  │         SocialAccount.ts  SocialDailyStat.ts      # schemas + indexes from §5
│     │  ├─ middleware/requireAuth.ts  validate.ts  errorHandler.ts  collectCors.ts  rateLimit.ts
│     │  ├─ routes/index.ts  health.ts  auth.ts  workspace.ts  sites.ts  collect.ts
│     │  │         stats.ts  social.ts  cron.ts           # each route returns 501 + TODO, except health
│     │  ├─ services/auth.service.ts  sites.service.ts  collect.service.ts  salt.service.ts
│     │  │           session.service.ts  stats.service.ts  csv.service.ts
│     │  ├─ social/provider.ts  registry.ts  crypto.ts  sync.ts
│     │  │         providers/mock.ts  meta.ts  youtube.ts  linkedin.ts  tiktok.ts  x.ts
│     │  └─ utils/hash.ts  ua.ts  logger.ts  httpError.ts
│     └─ test/health.test.ts     # Supertest: GET /api/health → 200 { ok: true }
├─ packages/
│  ├─ shared/                    # built with tsup to dist/ (ESM + .d.ts) so Vercel can use it
│  │  ├─ package.json  tsconfig.json  tsup.config.ts
│  │  ├─ src/index.ts
│  │  │     types.ts       # Channel, SocialPlatform, Period, Kpi, SeriesBucket, BreakdownRow, API request/response types
│  │  │     schemas.ts     # zod schemas for API inputs (stubs)
│  │  │     constants.ts   # CHANNELS (order + colors), SOCIAL_PLATFORMS (order + colors), PLATFORM_LABELS
│  │  │     classify.ts    # stub signature from §8
│  │  │     periods.ts     # stub signature from §9
│  │  │     domain.ts      # normalizeDomain / isValidHostname stubs
│  │  │     snippet.ts     # buildSnippet(site, trackerUrl) stub
│  │  └─ test/classify.test.ts  periods.test.ts  domain.test.ts   # it.todo(...) placeholders
│  └─ tracker/
│     ├─ package.json  tsconfig.json
│     ├─ src/index.ts            # stub IIFE that reads data-site and does nothing else yet
│     └─ build.mjs               # esbuild → apps/web/public/js/script.js; print gzip size; exit 1 if > 1.5 KB
├─ examples/test-site/index.html # plain page with the snippet (placeholder site key) for local testing
├─ scripts/seed.ts               # stub: connects to Mongo and logs "TODO(Phase 3)"
└─ e2e/
   ├─ playwright.config.ts
   └─ smoke.spec.ts              # test.fixme placeholder for the tracker → dashboard flow
```

## What the starter files must contain

- **Root `package.json` scripts:**
  - `dev`: shared watch + api + web together (use `concurrently`)
  - `build`, `typecheck`, `lint`, `format`, `test`
  - `test:e2e`, `build:tracker`, `seed`
- **`tsconfig.base.json`:** `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `moduleResolution: "bundler"`, `target: "ES2022"`, `skipLibCheck`.
- **Web:**
  - The router has every route from §11. Each page renders inside `AppShell`, styled with the tokens.
  - The shell has the top bar ("[YOUR BRAND]" logo, workspace name placeholder, "Sample data" badge) and the three tabs (Websites / Social media / Install code), as in the prototype.
  - Each page shows its heading and a placeholder card saying which phase builds it.
- **UI components:** create each with its typed props interface and a minimal working render that uses the prototype's styles (border, radius, hard shadow). No feature logic.
- **API:**
  - `GET /api/health` → `{ ok: true, time }`.
  - Every other router is mounted at the path from §10 and answers `501` with `{ error: "Not implemented", phase: N }`.
  - The error handler returns JSON and never leaks stack traces in production.
  - `env.ts` fails fast with a clear message when a required variable is missing. In dev, only `MONGODB_URI` is required.
- **Models:** full Mongoose schemas and indexes exactly as in §5. Pageview is a time-series collection. No service logic.
- **Shared constants:** the exact channel and social colors and their order from §12.
- **`.env.example` files:** every variable from §16, with a comment on each.
- **`.gitignore`:** node_modules, dist, .env*, apps/web/public/js/script.js, playwright reports, .vercel.
- **`README.md`:**
  - prerequisites (Node 22, a MongoDB Atlas connection string)
  - how to run locally
  - every script
  - where each phase's work lives
  - how to deploy the two Vercel projects (root directories `apps/web` and `apps/api`)
  - how the shared package is built before the API, and the build command each project needs
- **`CLAUDE.md`** (under 60 lines):
  - project summary in 3 lines
  - always read `docs/BUILD_PROMPT.md` before working
  - work one phase at a time and wait for approval
  - run `npm run typecheck && npm run lint && npm test` before saying a task is done
  - match `docs/design/prototype.html` for UI
  - never store visitor IPs
  - never add revenue features
  - ask before adding dependencies or paid services
  - log decisions in `docs/decisions.md`

## Done when

1. `npm install` works from the root.
2. `npm run dev` starts the web app at http://localhost:5173 and the API at http://localhost:4000.
3. The browser shows the shell with three working tabs and placeholder pages, in the prototype's design, in light and dark mode.
4. http://localhost:5173/api/health (through the Vite proxy) returns `{ ok: true }`.
5. `npm run typecheck`, `npm run lint` and `npm test` all pass. Placeholder tests use `it.todo` / `test.fixme`.
6. `npm run build:tracker` writes `apps/web/public/js/script.js` and prints its size.
7. `git init` is done, with a first commit: "chore: project scaffold".

When finished, show me the final tree (2 levels deep) and the output of the checks. Then stop. **Don't start Phase 1.** I'll tell you when to continue with `docs/BUILD_PROMPT.md`.
