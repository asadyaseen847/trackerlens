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

**Decision:** `Workspace.retentionMonths` (default 25). The Phase 6 weekly cron enforces it.
**Why:** §5 asks for a configurable setting, and the workspace is the natural place for it.

## 2026-10-13: Extra index on pageviews

**Decision:** `Pageview { 'meta.siteId': 1, ts: 1 }`, on top of the indexes listed in §5.
**Why:** Every stats query filters by site and time range.
