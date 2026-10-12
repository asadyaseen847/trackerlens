# Build brief: [YOUR BRAND] Audience Tracker

You are the lead engineer on a new product. Read this whole brief before writing any code. Then reply with:

1. A short summary of what you're going to build, in your own words.
2. Any questions from the "Questions to ask me first" section that I haven't answered.
3. Your plan for **Phase 0 only**.

Wait for my "go" before writing code. After that, work one phase at a time (see "Build phases"). Finish each phase completely, run the checks, show me what changed, and wait for my OK before starting the next one.

A clickable HTML prototype of the finished product is in `docs/design/prototype.html`. Open it in a browser. It is the source of truth for layout, copy, colors and behavior. Match it closely, but replace its fake sample data with real data from the API.

---

## 1. What the product does

A privacy-friendly **traffic analytics** tool. It shows how many people visit a customer's websites and which platform sent them. It does **not** track revenue, payments, ad spend or sales. Don't add any of those.

The product has three parts:

1. **Websites.** A customer adds one or more domains (for example `mybrand.com`, `shop.mybrand.com`). Each domain gets a unique one-line tracking script. The customer pastes it into the site's global header or footer. From then on, every page view is counted, along with where the visitor came from: Google, Instagram, TikTok, ChatGPT, a newsletter, direct, and so on.
2. **Social media.** The customer connects their own social accounts (Instagram, Facebook, YouTube, LinkedIn, TikTok, X). We show followers, new followers and post views, and compare them with the website visits each platform sent.
3. **Install code.** Generate and copy the tracking code, follow paste guides for common website builders, check that it's installed, manage site settings, and build trackable (UTM) links for social posts.

Who uses it: founders and small marketing teams. Keep the language plain. Say "visits", "where they came from" and "platform", not "sessions", "referrer" or "attribution".

---

## 2. Tech stack (decided)

MERN, all TypeScript (`strict: true`), deployed on Vercel.

| Part | Choice |
|---|---|
| Frontend | React + TypeScript + Vite, React Router, TanStack Query, zod for validation |
| Styling | Global `tokens.css` (copied from the prototype) + CSS Modules. No UI kit. |
| Charts | Port the prototype's hand-built SVG stacked-bar chart and sparkline into typed React components. No chart library unless I approve it. |
| Backend | Node.js + Express (TypeScript), zod for request validation |
| Database | MongoDB Atlas with Mongoose |
| Tracker script | Plain TypeScript, bundled with esbuild into one small minified IIFE file |
| Shared code | A `packages/shared` workspace for types, zod schemas, constants and the traffic classification rules |
| Tests | Vitest (unit), Supertest (API), Playwright (end-to-end smoke tests) |
| Tooling | npm workspaces, ESLint, Prettier, `tsc --noEmit` typecheck |

Before adding any dependency that isn't listed here, tell me what it's for. Don't add paid services without asking me first.

---

## 3. Repository layout

```
/
├─ apps/
│  ├─ web/                  # Vite + React dashboard (Vercel project #1)
│  │  ├─ public/js/script.js   # built tracker output (generated, not hand-edited)
│  │  └─ vercel.json           # SPA fallback + /api rewrite to the API project
│  └─ api/                  # Express API (Vercel project #2)
│     ├─ src/index.ts          # exports the Express app (default export)
│     └─ vercel.json           # cron jobs
├─ packages/
│  ├─ shared/               # types, zod schemas, classification rules, period math
│  └─ tracker/              # tracker source + esbuild build script
├─ examples/test-site/      # a plain HTML page with the snippet, for local testing
├─ scripts/seed.ts          # demo data generator
└─ docs/
   ├─ design/prototype.html # the design reference
   └─ BUILD_PROMPT.md       # this file
```

---

## 4. Deployment on Vercel

- Use **two Vercel projects** from the same Git repo: `apps/web` and `apps/api`, each with its own root directory.
- **API:** Vercel deploys Express with zero configuration when `src/index.ts` (or `app.ts`/`server.ts`) default-exports the Express app. The whole app runs as one Vercel Function. `express.static()` does not work on Vercel, so don't rely on it. Handle errors properly so a thrown error never leaves the function in a bad state.
- **Web:** `vercel.json` needs an SPA fallback to `index.html`, plus a rewrite of `/api/(.*)` to `https://api.[APP_DOMAIN]/api/$1`. That keeps the dashboard and API on the same site, so the login cookie stays first-party.
- **Tracker:** served as a static file from the web project at `https://[APP_DOMAIN]/js/script.js`, cached on the CDN. Keep the file name and the collect path neutral (`/js/script.js`, `/api/e`), because ad blockers block names like "analytics" and "track".
- **Collect endpoint:** the tracker posts directly to `https://api.[APP_DOMAIN]/api/e`, cross-origin, with no cookies.
- **Visitor country:** read it from Vercel's `x-vercel-ip-country` request header (a two-letter ISO code). The visitor's IP is in `x-forwarded-for` / `x-real-ip`. Use it only in memory to build the visitor hash, and never store it.
- **MongoDB on serverless:** cache the Mongoose connection on `globalThis` so warm invocations reuse it. Keep the pool small. Atlas network access must allow Vercel (for now, 0.0.0.0/0 with a strong password, or Vercel's MongoDB Atlas integration).
- **Cron:** use Vercel Cron Jobs in `apps/api/vercel.json`. Protect every cron route with `CRON_SECRET` by checking `Authorization: Bearer <CRON_SECRET>`.

Local development: run the web app (Vite dev server with a proxy for `/api`) and the API (`tsx watch`) together from the root with one command (`npm run dev`).

---

## 5. Data model (MongoDB / Mongoose)

All `_id`s are ObjectIds. All timestamps are UTC `Date`s. Bucket dates into the workspace's timezone only at query time.

```ts
User        { email (unique, lowercase), passwordHash, name, createdAt }
Workspace   { name, timezone /* IANA, e.g. "Asia/Karachi" */, members: [{ userId, role: 'owner' | 'member' }], createdAt }
Site        { workspaceId, domain /* "shop.example.com", no protocol, no www */, siteKey /* public id, e.g. "ws_7Q2K9X" */,
              settings: { includeSubdomains: boolean, paused: boolean, allowLocalhost: boolean },
              firstEventAt?: Date, lastEventAt?: Date, createdAt }
Salt        { day: 'YYYY-MM-DD', value /* 32 random bytes, hex */, createdAt }   // deleted after 2 days
Session     { siteId, visitorHash, startedAt, lastSeenAt, pageviews: number,
              entryPath, exitPath,
              channel: Channel, platform: string /* e.g. 'instagram', 'google', or a referrer host */, isPaid: boolean,
              referrerHost?: string,
              utm: { source?, medium?, campaign?, term?, content? },
              country: string /* ISO-2 or 'XX' */, device: 'phone' | 'tablet' | 'desktop', browser?, os? }
Pageview    (time-series collection: timeField 'ts', metaField 'meta')
            { ts, meta: { siteId }, sessionId, path, channel, platform, country, device }
SocialAccount   { workspaceId, platform: SocialPlatform, externalId, handle, name, avatarUrl?,
                  tokens: { accessTokenEnc, refreshTokenEnc?, expiresAt? }, scopes: string[],
                  status: 'connected' | 'needs_reconnect' | 'disconnected', lastSyncedAt?, createdAt }
SocialDailyStat { socialAccountId, day: 'YYYY-MM-DD', followers?, views?, engagements?, linkClicks? }
```

`type Channel = 'social' | 'search' | 'email' | 'ai' | 'direct' | 'other'`

Indexes, at minimum:
- `Session { siteId: 1, startedAt: 1 }`
- `Session { siteId: 1, visitorHash: 1, lastSeenAt: -1 }`
- `Session { siteId: 1, lastSeenAt: -1 }` (for "live now")
- `Site { siteKey: 1 }` unique
- `Site { workspaceId: 1, domain: 1 }` unique
- `SocialDailyStat { socialAccountId: 1, day: 1 }` unique

Add a configurable data retention setting (default 25 months). Implement it later in Phase 6.

---

## 6. The tracking script (`packages/tracker`)

**The snippet the dashboard generates:**

```html
<!-- [YOUR BRAND] traffic tracking for shop.example.com -->
<script defer data-site="ws_7Q2K9X" src="https://[APP_DOMAIN]/js/script.js"></script>
```

**Requirements:**
- Under **1.5 KB** minified and gzipped. No dependencies.
- No cookies. Don't write to `localStorage` or `sessionStorage`. The one exception is the "ignore my visits" flag below.
- Read `data-site` from `document.currentScript`. An optional `data-api` attribute overrides the collect URL (for customers who proxy it). The default collect URL is set at build time from `TRACKER_API_URL`.
- Send one pageview on load. For single-page apps, also send one whenever the URL changes: wrap `history.pushState` and `history.replaceState`, and listen to `popstate`. Skip a pageview if the path is the same as the last one sent less than 1 second ago.
- **Payload:** `{ s: siteKey, u: location.href without the #hash, r: document.referrer || null, w: window.innerWidth }`.
- **Transport:** `navigator.sendBeacon(url, new Blob([json], { type: 'text/plain' }))`. Fall back to `fetch(url, { method: 'POST', body: json, keepalive: true, headers: { 'Content-Type': 'text/plain' } })`. Use text/plain so the browser doesn't send a CORS preflight.
- **Don't send anything when:**
  - the page is opened from a `file:` URL
  - `navigator.webdriver` is true
  - the page is being prerendered (wait for `visibilitychange`)
  - the page is on `localhost` or `127.0.0.1`, unless `data-allow-localhost` is present
  - the "ignore my visits" flag is set
- **Ignore my own visits:** if the URL contains `?[brand]_ignore=1`, set `localStorage['[brand]_ignore'] = '1'`, log a short console message, and stop tracking. `?[brand]_ignore=0` removes the flag. Wrap all storage access in try/catch.
- Never throw an error into the host page. Wrap everything.

**Build:** `npm run build:tracker` bundles the script with esbuild (IIFE, minified, ES2017 target) into `apps/web/public/js/script.js` and prints its gzipped size. CI fails if it's over 1.5 KB.

---

## 7. The collect endpoint `POST /api/e`

1. **CORS:** `Access-Control-Allow-Origin: *`. Allow `POST` and `OPTIONS`. No credentials.
2. Accept a `text/plain` body of at most 2 KB. Parse it as JSON and validate with zod. Anything invalid → `202` and drop it. Never return a 5xx to the tracker.
3. Look up the Site by `siteKey`, with a 60-second in-memory cache. Drop the hit if the site is missing or paused.
4. **Hostname check:** the page URL's hostname, with a leading `www.` removed, must equal `site.domain`, or end with `.` + `site.domain` when `includeSubdomains` is on. `localhost` passes only when `allowLocalhost` is on. Otherwise drop the hit. This stops other websites counting under someone else's code.
5. **Bots:** drop the hit if the user agent is missing or the `isbot` package flags it.
6. **Country:** `x-vercel-ip-country`, or `'XX'` if it's missing.
7. **Visitor hash:** `sha256(dailySalt + siteId + ip + userAgent)`, first 16 hex characters. Create the day's salt lazily on first use (UTC day). A cron job deletes salts older than 2 days. **Never store or log the IP.**
8. **Device** from `w`: under 768 is `phone`, under 1024 is `tablet`, otherwise `desktop`. Browser and OS come from an MIT-licensed user-agent parser (for example `bowser`).
9. **Session:**
   - Find a session with the same `siteId` + `visitorHash` whose `lastSeenAt` is within the last 30 minutes.
   - If there is one, increment `pageviews` and set `lastSeenAt` and `exitPath`. A referrer from the same site doesn't change the source.
   - Otherwise create a new session. Its source comes from this hit, classified with the rules in section 8.
10. Insert a Pageview document with the session's channel, platform, country and device copied onto it.
11. Update `site.lastEventAt` at most once a minute. Set `firstEventAt` if it's empty.
12. Respond `202` as fast as possible.

Rate limiting: rely on Vercel Firewall rules in production. Add a simple per-IP in-memory limit as a safety net, without storing the IP.

---

## 8. Traffic classification (`packages/shared/classify.ts`)

`classify({ pageUrl, referrer, siteDomain }) → { channel, platform, isPaid, referrerHost, utm }`

Apply these rules **in this order**:

1. Read `utm_source`, `utm_medium`, `utm_campaign`, `utm_term` and `utm_content` from the page URL.
2. `isPaid` is true when `utm_medium` is one of `cpc | ppc | paid | paid_social | paidsocial | display | ads`.
3. **If `utm_source` is present:**
   - Normalize it with these aliases: `ig`, `insta` → `instagram`; `fb`, `meta` → `facebook`; `tw`, `twitter` → `x`; `li` → `linkedin`; `yt` → `youtube`; `tt` → `tiktok`; `gpt`, `openai` → `chatgpt`.
   - If it matches a known platform, use that platform and its channel.
   - Else if `utm_medium` is `email` or `newsletter`, the channel is `email` and the platform is the source.
   - Otherwise the channel is `other` and the platform is the source.
4. **Else if there is a referrer:**
   - A referrer from the site's own domain (including subdomains) is internal. It doesn't start a new source.
   - Otherwise match the referrer host against the table below. Ignore `www.` and `m.`, and compare the end of the host.
5. **Otherwise:** the channel is `direct` and the platform is `direct`.

| Channel | Platform | Referrer hosts |
|---|---|---|
| search | google | `google.*` (any TLD, e.g. google.com, google.co.uk, google.com.pk) |
| search | bing | bing.com |
| search | duckduckgo | duckduckgo.com |
| search | yahoo | search.yahoo.com, yahoo.com |
| search | yandex | yandex.* |
| search | baidu | baidu.com |
| search | ecosia | ecosia.org |
| search | brave | search.brave.com |
| social | facebook | facebook.com, l.facebook.com, lm.facebook.com, fb.com, fb.me |
| social | instagram | instagram.com, l.instagram.com |
| social | x | t.co, x.com, twitter.com |
| social | linkedin | linkedin.com, lnkd.in |
| social | tiktok | tiktok.com |
| social | youtube | youtube.com, youtu.be |
| social | reddit | reddit.com, out.reddit.com, old.reddit.com |
| social | pinterest | pinterest.*, pin.it |
| social | threads | threads.net, threads.com |
| social | snapchat | snapchat.com |
| social | quora | quora.com |
| social | telegram | t.me, web.telegram.org |
| social | whatsapp | wa.me, web.whatsapp.com |
| ai | chatgpt | chatgpt.com, chat.openai.com |
| ai | perplexity | perplexity.ai |
| ai | gemini | gemini.google.com (check this **before** the `google.*` search rule) |
| ai | copilot | copilot.microsoft.com |
| ai | claude | claude.ai |
| email | gmail | mail.google.com (check before `google.*`) |
| email | outlook | outlook.live.com, outlook.office.com |
| email | yahoo-mail | mail.yahoo.com |
| other | *referrer host* | anything else |

Keep a `PLATFORM_LABELS` map for display names ("X / Twitter", "Typed in or bookmarked" for direct, and so on).

Write table-driven Vitest tests covering at least 40 cases, including:
- UTM overriding the referrer
- paid UTMs
- `gemini.google.com` vs `google.com`
- `mail.google.com`
- the site's own subdomains
- an empty referrer with no UTM

---

## 9. Stats definitions (use these everywhere)

- **Visit:** one session (30 minutes without activity ends it). "Visits" = sessions started in the range.
- **Unique visitors:** distinct `visitorHash` in the range. The hash changes every day by design, so someone who visits on 3 days counts 3 times. Explain this in a small info tooltip.
- **Pages viewed:** pageviews in the range.
- **On the site right now:** distinct `visitorHash` with `lastSeenAt` in the last 5 minutes. Poll every 15 seconds.
- **Source of a visit:** the first hit of the session.
- **Periods** (in the workspace's timezone; weeks start on Monday):
  - **Daily:** the last 30 days, including today. Today's bar is partial.
  - **Weekly:** the last 12 weeks, including the current one (partial).
  - **Monthly:** the last 12 months, including the current one (partial).
  - **Yearly:** every year since the site's first data, including the current one (partial).
  - Partial buckets are drawn striped, as in the prototype.
- **Comparison ("vs before"):** the range of the same length just before it. For Yearly, compare this year so far with the same dates last year.
- **Filters:** one site or all sites in the workspace, channels (multi-select), device, country. Every number, chart and list on the page respects every filter.
- Use `$dateTrunc` with the `timezone` and `startOfWeek: 'monday'` options for bucketing. Put the period and range math in `packages/shared/periods.ts` and unit-test it, including daylight-saving changes and the year boundary.

---

## 10. REST API

All routes are under `/api`. JSON in and out. Every request body and query string is validated with zod. Request and response types live in `packages/shared` and are used by both the web app and the API.

**Auth** (email + password, bcrypt, JWT in an `httpOnly`, `Secure`, `SameSite=Lax` cookie):
- `POST /auth/signup` (creates the user, a workspace and its timezone)
- `POST /auth/login`
- `POST /auth/logout`
- `GET /auth/me`

**Workspace:**
- `GET /workspace`
- `PATCH /workspace` (name, timezone)

**Sites:**
- `GET /sites` (each with status: `waiting` | `live` | `paused`, plus visits in the last 30 days and a 14-day sparkline)
- `POST /sites { domain }`:
  - normalize the domain: strip protocol, path, port and `www.`; lowercase it
  - validate the hostname
  - reject duplicates within the workspace
  - generate a `siteKey` from 6 characters of an unambiguous alphabet, with a prefix
- `GET /sites/:id`
- `PATCH /sites/:id` (settings)
- `DELETE /sites/:id` (owner only; asks for confirmation in the UI; deletes sessions and pageviews)
- `GET /sites/:id/snippet` → `{ html }`
- `GET /sites/:id/status` → `{ installed: boolean, lastEventAt }` (used by "Check installation")

**Stats.** Query string: `site=all|<id>`, `period=daily|weekly|monthly|yearly`, `channels=social,search`, `device=`, `country=`.
- `GET /stats/overview` → `{ range, compareRange, kpis: { visits, visitors, pageviews } each with { value, previous, changePct }, series: [{ start, label, fullLabel, partial, byChannel: Record<Channel, number> }] }`
- `GET /stats/breakdown?dimension=platform|page|campaign|country|device&limit=10` → `{ rows: [{ key, label, channel?, value, share, previous, changePct }] }`. Pages count pageviews. Every other dimension counts visits.
- `GET /stats/live?site=` → `{ count }`
- `GET /stats/export.csv` (same filters; one row per bucket and channel)

**Social:**
- `GET /social/accounts`
- `GET /social/connect/:platform` → redirects to the platform's OAuth screen (with a signed `state`)
- `GET /social/callback/:platform`
- `DELETE /social/accounts/:id`
- `GET /social/overview?period=` → totals (followers, new followers, views, visits to websites) plus a per-platform series and the "views → visits" table

**Cron** (Bearer `CRON_SECRET`):
- `GET /cron/cleanup-salts` (daily)
- `GET /cron/social-sync` (daily)
- `GET /cron/retention` (weekly; Phase 6)

**Public:**
- `POST /e` (collect)
- `GET /health`

Authorization: every query is scoped to the signed-in user's workspace. Check workspace membership on every route that takes an id, and write a test proving a user can't read another workspace's site.

---

## 11. Frontend (match `docs/design/prototype.html`)

**Routes:**
- `/login`, `/signup`
- `/onboarding` (name the workspace, add the first website, show the code)
- `/app/websites`
- `/app/social`
- `/app/install`
- `/app/settings` (workspace name and timezone, account)

Keep the filter state in the URL query string (`?site=&period=&channels=&device=&country=`) so views can be shared and survive a reload.

**Layout:** a top bar (brand, workspace name), then tabs (Websites / Social media / Install code), as in the prototype. The tabs are real routes, with proper ARIA tab semantics.

**Websites page:**
1. Heading, plus a one-sentence insight. Example: "**Instagram** sent the most visits to shop.example.com (31%). **TikTok** grew the fastest, up 42%." Build it from the breakdown data.
2. The period switch (Daily / Weekly / Monthly / Yearly).
3. Site cards:
   - an "All websites" card first, then one card per site
   - each card shows a status chip, its visits, and a 14-day sparkline
   - the selected card is inverted (ink background)
   - an "Add website" card comes last
4. A filter bar: device select, country select, and channel chips (`aria-pressed`). At least one channel always stays on, and a "Show all" button appears when some are off.
5. Four tiles: Visits (the one lime tile), Unique visitors, Pages viewed, On the site right now (pulsing dot). The first three show change chips: ▲ green, ▼ pink, always with the number.
6. The stacked bar chart of visits per bucket, split by channel:
   - hover or tap shows a tooltip with every channel and the total
   - arrow keys move between bars, with a polite live-region announcement
   - a Chart / Table toggle
7. Breakdown panels: Platforms, Top pages, Campaigns (UTM), Countries, Devices. Each row has a name, a value, a change chip, a share bar and a percentage.
8. Empty state for a site with no data: "Waiting for the first visit" and a "Get the code" button.

**Social page** (built against the mock provider first, see section 13):
- 4 tiles: Followers, New followers, Post views, Visits to your websites.
- One card per platform:
  - connected cards show followers, the change, views, engagement and site visits
  - unconnected cards show what we can read, plus a Connect button
- A stacked bar chart of views per platform.
- The table "From social post to website visit": views, visits, visits per 1,000 views, new followers, with a "Best" badge on the top row.

**Install page:**
- A site selector, the snippet box (ink background, site key highlighted in lime) and a Copy button. If clipboard access fails, select the text and show "Press Ctrl+C".
- Builder guides as segmented tabs: Any website, WordPress, Shopify, Webflow, Wix, Google Tag Manager. Use the exact steps from the prototype.
- A "Check installation" button that calls `/sites/:id/status` and says "Working. Last visit 2 minutes ago" or "No visits yet …".
- Site settings toggles:
  - count subdomains
  - pause tracking
  - "Ignore my visits", which shows the `?[brand]_ignore=1` link to open once on their site
  - remove website, with a confirmation step
- The UTM link builder (client-side): page URL, platform, campaign name → link + Copy.
- "What the code collects", in plain words, as in the prototype.

**Add website dialog:** two steps. (1) The domain, with inline validation messages from the prototype. (2) The code, with Copy, "Show install steps" and Done. It needs a focus trap, closes on Escape, and returns focus afterwards.

**General:**
- loading skeletons
- friendly error messages that say what to do
- toasts for copy, save and connect actions
- everything works at 390 px wide with no horizontal scroll
- light and dark themes via the tokens
- visible focus rings
- respect `prefers-reduced-motion`
- all form controls labeled

---

## 12. Design system (copy from the prototype)

- **Fonts** (Google Fonts): **Unbounded** 600–800 for headings and big numbers; **Bricolage Grotesque** 400–800 for everything else. Use tabular numbers for all figures.
- **Look:** bold "neo-brutalist". 2 px ink borders, 20–22 px corners, hard offset shadows (`5px 5px 0` or `6px 6px 0` in the shadow color), flat fills. No gradients, no blurry shadows, no emoji.
- **Tokens:** copy the whole `:root` block and both dark-mode blocks from the prototype into `apps/web/src/styles/tokens.css`. Key light values:
  - background `#F3F0FF`, surface `#FFFFFF`, ink `#16131F`, muted text `#5B5670`, lines `#E6E2F3`
  - accent lime `#C8F542` (text on it is always ink)
  - status chip fills: good `#E3FBB0`, bad `#FFD6CF`, waiting `#FFE9B8`
- **Channel colors** (these were tested for color-blind safety, so don't change them or their order):
  - social `#FF3D8B`
  - search `#2F6BFF`
  - email `#E86A00`
  - ai `#6C3CF5`
  - direct `#0E9F92`
  - other `#BDB7CC`
  - The dark-mode values are in the prototype.
- **Social platform colors** for the social chart, in this order:
  - Instagram `#FF3D8B`
  - Facebook `#2F6BFF`
  - YouTube `#E86A00`
  - LinkedIn `#6C3CF5`
  - TikTok `#0E9F92`
  - X `#A38200`
- **Rules:**
  1. Only one lime element per screen (the main tile or the main button).
  2. Text is never in a chart color. Numbers and labels stay ink or muted, with a colored swatch next to them.
  3. Change chips always show an arrow and a number, never color alone.
  4. Charts: 2 px gaps between stacked segments; only the top segment gets 4 px rounded corners; one y-axis only; gridlines in the line color; always a legend; always a table view.

---

## 13. Social media module

Build it in two steps.

**Step A (Phase 4): the architecture, a mock provider and the UI.**

```ts
type SocialPlatform = 'instagram' | 'facebook' | 'youtube' | 'linkedin' | 'tiktok' | 'x';
interface SocialProvider {
  id: SocialPlatform;
  getAuthUrl(state: string): string;
  exchangeCode(code: string): Promise<TokenSet>;
  refresh?(tokens: TokenSet): Promise<TokenSet>;
  fetchProfile(tokens: TokenSet): Promise<{ externalId: string; handle: string; name: string; avatarUrl?: string }>;
  fetchDailyStats(tokens: TokenSet, fromDay: string, toDay: string): Promise<Array<{ day: string; followers?: number; views?: number; engagements?: number; linkClicks?: number }>>;
}
```

- `MockProvider` produces deterministic sample data. It's enabled with `SOCIAL_MOCK=true` and clearly labeled "Sample data" in the UI.
- Encrypt tokens at rest with AES-256-GCM, using `ENCRYPTION_KEY`.
- Daily sync cron: for each connected account, fetch from the last synced day to yesterday, then upsert `SocialDailyStat`. Mark accounts `needs_reconnect` when the platform refuses the token.
- "Visits to your websites" for a platform = the website sessions whose `platform` matches.

**Step B (Phase 5+): real providers, one at a time.** Order: Meta (Facebook Page + Instagram professional account), then YouTube, then LinkedIn (company page), then TikTok, then X.

**Before coding each provider:**
1. Read that platform's **current official developer docs**.
2. Write a short note listing the exact scopes, endpoints, metric names, rate limits, account requirements (for example: Instagram needs a Business or Creator account) and the app review or approval steps.
3. Show me that note and wait for my OK.

Don't guess endpoint or metric names. If the docs are unclear, ask me. Expect X to require a paid API plan, so confirm the cost with me before building it.

---

## 14. Security and privacy

- Never store visitor IP addresses or full user agents on pageviews. Keep only the derived browser and OS names.
- No cookies on customer websites.
- Passwords: bcrypt with cost 12.
- Rate-limit the auth endpoints.
- Validate every input with zod.
- Use `helmet` on the API.
- The JWT secret, encryption key and OAuth secrets come only from environment variables. Never log them.
- Scope everything to the workspace. Write tests for cross-workspace access.
- Add a public `/privacy` page in plain language that matches "What the code collects".

---

## 15. Quality bar

- `npm run typecheck`, `npm run lint` and `npm test` all pass before you tell me a phase is done.
- Unit tests:
  - classification (40+ cases)
  - period math
  - domain normalization and validation
  - the visitor hash (same input on the same day gives the same hash; the next day it differs)
  - snippet generation
- API tests: auth, sites CRUD, workspace isolation, collect (valid hit, wrong domain, bot, paused site), stats overview on seeded data.
- **Playwright smoke test:**
  1. Start the API and serve `examples/test-site`.
  2. Load the page.
  3. Check that a session and a pageview appear in the database.
  4. Open the dashboard and check the visit shows up.
- `scripts/seed.ts` (`npm run seed`) creates a demo user (`demo@example.com` / `demo1234`, dev only) and a workspace with 3 sites (`mybrand.com`, `shop.mybrand.com`, `blog.mybrand.com`). It fills 18 months of realistic, deterministic sessions and pageviews, with weekday patterns, growth, occasional viral spikes, and a channel and platform mix like the prototype's. That way every chart has data during development.
- Keep a `README.md` up to date: setup, env vars, scripts, deployment steps.

---

## 16. Environment variables

```
# api
MONGODB_URI=
JWT_SECRET=
ENCRYPTION_KEY=            # 32 bytes, base64
APP_URL=https://[APP_DOMAIN]
CRON_SECRET=
SOCIAL_MOCK=true
META_APP_ID=  META_APP_SECRET=
GOOGLE_CLIENT_ID=  GOOGLE_CLIENT_SECRET=      # YouTube
LINKEDIN_CLIENT_ID=  LINKEDIN_CLIENT_SECRET=
TIKTOK_CLIENT_KEY=  TIKTOK_CLIENT_SECRET=
X_CLIENT_ID=  X_CLIENT_SECRET=

# web
VITE_API_URL=/api

# tracker build
TRACKER_API_URL=https://api.[APP_DOMAIN]/api/e
```

Add a `.env.example` for each app. Never commit real `.env` files.

---

## 17. Build phases

Finish each phase, run all checks, summarize what changed, and wait for my OK before the next one.

| Phase | What to build | Done when |
|---|---|---|
| **0. Setup** | Monorepo, TypeScript strict, ESLint/Prettier, Vitest, shared package, tokens.css + fonts, empty app shell with tabs, Express app with `/api/health`, Mongo connection helper, `npm run dev` | `npm run dev` shows the shell; `/api/health` returns ok; checks pass |
| **1. Accounts & sites** | Auth, workspace, sites CRUD, snippet generation, onboarding, Install page (snippet, guides, settings, link builder), Add website dialog | I can sign up, add a domain, copy its code, change settings and remove a site |
| **2. Tracking** | Tracker script + build, collect endpoint, salts, classification, sessions/pageviews, "Check installation", test site, Playwright smoke test | Opening the test site creates a correct session; "Check installation" says Working; tracker is ≤ 1.5 KB gzipped |
| **3. Websites dashboard** | Stats API (overview, breakdown, live, CSV), seed script, full Websites page with all filters, chart, table view, panels and insight sentence | The dashboard matches the prototype on seeded data, in light and dark, at 390 px and 1280 px |
| **4. Social (mock)** | Provider interface, MockProvider, accounts/overview API, Social page, daily sync cron | The Social page matches the prototype using mock data |
| **5. Real social providers** | Meta first, after my OK on your docs note; then the others one by one | I can connect a real Facebook Page / Instagram account and see real numbers |
| **6. Hardening & launch** | Vercel projects and env vars, cron jobs, data retention, Firewall rate-limit notes, error monitoring hook, `/privacy`, performance check (stats queries under 500 ms on 1M pageviews; add daily rollups if needed) | Deployed to production URLs; checklist in README complete |

---

## 18. Out of scope (don't build)

Revenue, payments, Stripe, ad spend, CRM integrations, session replay, heatmaps, A/B tests, mobile app SDKs, custom event tracking (the API may leave room for it later), team invites (later), billing.

---

## 19. Questions to ask me first (if not answered here)

1. The product name and the final `[APP_DOMAIN]` (for example `app.yourbrand.com` and `api.yourbrand.com`).
2. Is a MongoDB Atlas cluster ready? Which region? It should be close to the Vercel function region.
3. Should "Daily" include today (partial), as specified above?
4. How long should we keep raw data (default 25 months)?
5. Do we need Google sign-in in addition to email and password?
