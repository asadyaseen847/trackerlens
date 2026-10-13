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

## 2026-10-13: `src/app.ts` renamed to `src/createApp.ts`

**Context:** The first working build crashed on every request: `Invalid export found in module ".../src/app.js". The default export must be a function or server`. Vercel's Express preset uses the first file it finds among `src/app`, `src/index` and `src/server`, and `app.ts` only exported `createApp`.
**Decision:** The app factory lives in `src/createApp.ts`. `src/index.ts` is the only entrypoint and default-exports the app. `test/entrypoint.test.ts` fails if `src/app.*` or `src/server.*` is added again.
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
- The pageview time-series collection becomes a `pageviews` table indexed on `(site_id, ts)`, plus a BRIN index on `ts`.
- `$dateTrunc` becomes `date_trunc(unit, ts at time zone tz)`, inside Postgres functions called with `db.rpc` (Phase 3).
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

## 2026-10-13: Extra indexes on pageviews

**Decision:** `pageviews (site_id, ts)`, `pageviews (session_id)` and a BRIN index on `ts`, on top of the indexes listed in §5.
**Why:** Every stats query filters by site and time range. The session index keeps cascading deletes fast, and BRIN makes retention deletes cheap.
