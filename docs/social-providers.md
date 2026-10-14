# Social providers: Phase 5 notes

BUILD_PROMPT §13 says that before coding each real provider we read that platform's current official developer docs, write a note (scopes, endpoints, metric names, rate limits, account requirements, app review), and wait for the owner's OK. The order is Meta → YouTube → LinkedIn → TikTok → X.

**Status:** the Meta note is below, researched from developers.facebook.com on 2026-10-13. It is **waiting for your OK**. The other platforms haven't been researched yet. Until a provider ships, the product runs with `SOCIAL_MOCK=true` (sample data, labeled "Sample data").

Everything around the providers already exists:

- the provider interface (`apps/api/src/social/provider.ts`);
- OAuth state signing;
- encrypted token storage (`social_account_tokens`);
- the daily sync cron, and `needs_reconnect` when a platform refuses a token;
- the Social page.

A real provider is "only" one file implementing `getAuthUrl`, `exchangeCode`, `refresh`, `fetchProfile` and `fetchDailyStats`.

---

## What you (the owner) need to do for Meta

These steps can't be done from code. They need your Facebook account and your business details.

1. Create a **Business-type app** at developers.facebook.com and add **Facebook Login for Business**.
2. Under Facebook Login for Business, create a **Configuration**: user access token, with the permissions listed below.
3. Set the redirect URI to `https://<your web domain>/api/social/callback/facebook` (and `/instagram`).
4. Add your **privacy policy URL** (`https://<web domain>/privacy`) and a **data deletion** URL. We'll add the callback endpoint when we build the provider.
5. Put `META_APP_ID` and `META_APP_SECRET` in the API's Vercel environment variables.
6. While the app is in **Development mode**, you (and anyone you add as a tester) can connect your own Page and Instagram account. That's enough to build and test.
7. To let **customers** connect their accounts: complete **Business Verification**, then submit **App Review** for Advanced Access. That needs a usage description and a screencast per permission, plus a working test login for the reviewers.

---

## Meta (Facebook Page + Instagram professional account): research note

Sources are developers.facebook.com pages (linked). Anything marked _unconfirmed_ wasn't stated on an official page.

**API version:** Graph API **v26.0** is current (released Jul 29, 2026). We'll pin it in code. ([changelog](https://developers.facebook.com/docs/graph-api/changelog))

### Login

- **Facebook Login for Business** (FLfB) is Meta's preferred login for business integrations. It is Business-type apps only, and a `config_id` replaces `scope`. ([FLfB](https://developers.facebook.com/docs/facebook-login/facebook-login-for-business))
- One FLfB login gives both:
  - Facebook Page insights;
  - insights for Instagram Business/Creator accounts **linked to a Page** ("Instagram API with Facebook Login").
- There is also "Instagram API with Instagram Login" (no Page needed, `graph.instagram.com`). It could be added later for Instagram accounts without a Page. ([IG overview](https://developers.facebook.com/docs/instagram-platform/overview))

### Permissions

- **Facebook Page:** `pages_show_list`, `pages_read_engagement`, `read_insights`. ([Page insights](https://developers.facebook.com/docs/graph-api/reference/insights), [permissions](https://developers.facebook.com/docs/permissions))
- **Instagram via FLfB:** `instagram_basic`, `instagram_manage_insights` (plus the Page permissions). `ads_read` is needed only if the person manages the Page through Business Manager. ([IG user insights](https://developers.facebook.com/docs/instagram-platform/api-reference/instagram-user/insights))

### Tokens

1. Swap the short-lived user token for a **long-lived user token** (about 60 days) with `GET /oauth/access_token?grant_type=fb_exchange_token…`. This runs on the server.
2. Call `GET /me/accounts` to get **Page tokens**. These have no fixed expiry; they only stop working on password changes, removed roles and similar events.
3. We store the Page token, encrypted. ([long-lived tokens](https://developers.facebook.com/docs/facebook-login/guides/access-tokens/get-long-lived))

### Metrics → our daily fields

| Our field   | Facebook Page (`GET /{page-id}/insights?period=day`)                                           | Instagram (`GET /{ig-user-id}/insights`, `period=day`)                  |
| ----------- | ---------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| followers   | `page_follows` (`page_fans` was removed Nov 2025)                                              | `followers_count` field on the IG user, snapshotted daily               |
| views       | `page_media_view` (`page_impressions` was removed Nov 2025)                                    | `views` (`metric_type=total_value`; `impressions` was removed Apr 2025) |
| engagements | `page_post_engagements`                                                                        | `total_interactions`                                                    |
| link clicks | `page_total_actions` (CTA and contact clicks only); _no confirmed per-day website-link metric_ | `profile_links_taps` (contact buttons); _website taps unconfirmed_      |

### Limits and gotchas

- **Facebook Page insights:**
  - at most 90 days per request, and the last 2 years only;
  - updated about every 24 hours;
  - **Pages need 100+ likes**.
- **Instagram:**
  - data can be up to 48 hours late;
  - user metrics are kept about 90 days;
  - some metrics need **100+ followers**.
- **Rate limits:** Business Use Case limits for Pages (4,800 × engaged users / 24 h) and Instagram, reported in the `X-Business-Use-Case-Usage` header. We'd back off when usage is high. ([rate limiting](https://developers.facebook.com/docs/graph-api/overview/rate-limiting))

### Proposed implementation

- **Login:** FLfB with the authorization-code flow (server-side).
- **Connecting:** after login, list the person's Pages (and linked Instagram accounts) and connect each as its own `social_accounts` row.
- **Daily sync:** re-fetch the last 3 days each run, to absorb Meta's 24–48 hour delay. The upsert makes this safe.
- **Link clicks:** "link clicks" will be the closest available metric (CTA, contact or profile-link taps), labeled honestly in the UI.

### Open questions and risks

- Meta announced that "a number of Page Insights metrics" would be removed by June 2026. We need to confirm on a live Page that `page_media_view`, `page_follows` and `page_total_actions` still return data on v26.
- Neither platform has a confirmed daily **website-click** metric. The "visits to your websites" numbers come from our own tracker anyway, which is better data.
- Small accounts (under 100 likes or followers) will show empty insights. The UI should say so instead of showing 0.
- Customers' accounts can't connect until **Business Verification + App Review** pass, which can take weeks.

**Decision needed from you:** OK to build Meta this way? You also need to create the Meta app (steps above) and share `META_APP_ID` / `META_APP_SECRET` through Vercel's environment variables, not in chat.

---

## LinkedIn (built)

Status: **code done and tested** (`apps/api/src/social/providers/linkedin.ts`, `apps/api/test/linkedin.test.ts`). It goes live once the app credentials below are set. Researched from LinkedIn's Marketing API docs, version 202609 (October 2026).

**What it reads, for one company page the person administers:**

| Our field   | LinkedIn source                                                                                         |
| ----------- | ------------------------------------------------------------------------------------------------------- |
| followers   | today's total (`/rest/networkSizes/{org}?edgeType=COMPANY_FOLLOWED_BY_MEMBER`), minus later daily gains |
| (gains)     | `/rest/organizationalEntityFollowerStatistics`, DAY intervals: organic + paid follower gains            |
| views       | `/rest/organizationalEntityShareStatistics`, DAY intervals: `impressionCount` (organic posts)           |
| engagements | likes + comments + shares + clicks from the same rows                                                   |
| link_clicks | `clickCount`                                                                                            |

**Login:** "Sign in with LinkedIn" (OAuth 2.0, 3-legged). Scopes `r_organization_admin rw_organization_admin`. After login, `/rest/organizationAcls?q=roleAssignee&role=ADMINISTRATOR&state=APPROVED` finds the first page the person administers. If there is none, the person is told to ask a page admin.

**Tokens:** access tokens last 60 days. Apps approved for the Community Management API also get a refresh token (1 year). The daily sync renews the access token a day before it expires; without a refresh token the card asks to reconnect.

**Limits:**

- 12 months of daily history; the first sync loads 90 days.
- Follower gains arrive about 2 days late, so every sync re-reads the last 3 days.
- Posts' numbers are organic only; ads are not included.
- One page per connection: the first one the person administers.

### What you (the owner) need to do for LinkedIn

1. Have a **LinkedIn company page** that you are an **admin** of.
2. Go to https://www.linkedin.com/developers/apps → **Create app**.
   - Use your company page as the app's page.
   - Add a logo and the privacy policy URL `https://trackerlens-web.vercel.app/privacy`.
   - The page admin verifies the app (Settings tab → **Verify**).
3. **Products** tab → request **Community Management API**. LinkedIn reviews it; this can take days to weeks. Until it is approved, the login screen says the scopes are not allowed.
4. **Auth** tab:
   - add the redirect URL `https://trackerlens-web.vercel.app/api/social/callback/linkedin`;
   - copy the **Client ID** and **Primary Client Secret**.
5. In Vercel → `trackerlens-api` → Settings → Environment Variables, set:
   - `LINKEDIN_CLIENT_ID` and `LINKEDIN_CLIENT_SECRET`;
   - `SOCIAL_MOCK=false`;
   - `ENCRYPTION_KEY`, generated once (see `apps/api/.env.example`).

   Then redeploy.

6. Open TrackerLens → Social → **Connect LinkedIn**, sign in, and allow. The card shows your page's name and the last 90 days.

**Keep in mind:** LinkedIn retires each API version after about a year. When the deprecation notice for 202609 appears, set `LINKEDIN_API_VERSION` to a newer `YYYYMM` (no code change needed if the fields stay the same).

## YouTube, TikTok, X

Not researched yet; we do them one at a time, per §13. Known up front:

- **YouTube:** Google Cloud project, OAuth consent screen, YouTube Analytics API. Google's verification is needed for public use.
- **TikTok:** TikTok for Developers app with the Display API / Research access; business accounts only.
- **X:** API access is paid. **Confirm the plan and cost before we build it**, as §13 requires.
