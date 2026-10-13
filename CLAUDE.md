# CLAUDE.md

## Project

[YOUR BRAND] Audience Tracker: privacy-friendly traffic analytics. It counts visits to a customer's websites and shows which platform sent them.
It also compares social media audiences (followers, post views) with the website visits each platform sends.
TypeScript monorepo (npm workspaces): `apps/web` (Vite + React), `apps/api` (Express on Vercel), `packages/shared`, `packages/tracker`. Database: Supabase Postgres (replaces the brief's MongoDB; see `docs/decisions.md`).

## Before you work

- Always read `docs/BUILD_PROMPT.md` first. It is the spec. Section numbers (§N) in TODOs point into it.
- Work one phase at a time (§17). Finish it, run the checks, summarize what changed, and **wait for approval** before starting the next phase.
- Search for `TODO(Phase N` to find the stubs a phase has to fill in.

## Before saying a task is done

```
npm run typecheck && npm run lint && npm test
```

All three must pass. For tracker changes, also run `npm run build:tracker`; it must stay ≤ 1.5 KB gzipped.

## Rules

- UI must match `docs/design/prototype.html` (layout, copy, colors, behavior). Tokens live in `apps/web/src/styles/tokens.css`, copied from the prototype. Never edit the prototype or `docs/BUILD_PROMPT.md`.
- Never store or log visitor IP addresses or full user agents. IPs are used only in memory to build the daily visitor hash.
- No cookies or storage on customer websites. The only exception is the "ignore my visits" flag.
- Never add revenue, payments, ad spend or anything else from §18 (out of scope).
- Ask before adding a dependency that isn't in §2, and before using any paid service.
- Log non-obvious technical decisions in `docs/decisions.md`.
- Use plain language in the UI: "visits", "where they came from", "platform". Not "sessions", "referrer" or "attribution".
- Scope every API query to the signed-in user's workspace. The API uses the Supabase service-role key, which bypasses RLS, so our code is the only guard. Validate every input with zod.
- Schema changes go in a new file in `supabase/migrations/` (never edit an applied one). Keep RLS enabled on every table, then update `apps/api/src/db/database.types.ts` (`npm run db:types`).
- Never expose `SUPABASE_SERVICE_ROLE_KEY` to the web app or the browser.

## Conventions

- TypeScript `strict` + `exactOptionalPropertyTypes` + `noUncheckedIndexedAccess`; ES modules everywhere.
- API and shared imports use `.js` extensions. Web imports have no extension (Vite).
- Shared types and zod schemas go in `packages/shared`. Run `npm run build -w @audience/shared` after changing it, unless `npm run dev` is running (it watches).
- API stubs answer `501 { error: "Not implemented", phase }`. Errors are thrown as `HttpError`.
- The database client is `getDb()` from `apps/api/src/db/supabase.ts`. Always check `error` on every query result.
- Add or remove dependencies with `npx npm@11 install …` (npm 10.9 crashes; see README).
- Validated request data is read from `res.locals.body` / `.query` / `.params` (see `middleware/validate.ts`).
