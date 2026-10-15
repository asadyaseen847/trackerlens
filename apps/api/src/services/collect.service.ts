import { classify, collectPayloadSchema, type CollectPayload } from '@audience/shared';
import type { Repo, SiteRow } from '../db/repo.js';
import { visitorHash } from '../utils/hash.js';
import { deviceFromWidth, isBotUserAgent, parseUserAgent } from '../utils/ua.js';
import { getDailySalt } from './salt.service.js';

export interface CollectContext {
  /** In memory only; never stored or logged. */
  ip: string;
  userAgent: string | undefined;
  /** x-vercel-ip-country, if present. */
  country: string | undefined;
  now?: Date;
}

/** What happened to a hit. Everything except "recorded" is silently dropped (still 202). */
export type HitOutcome = 'recorded' | 'invalid' | 'unknown_site' | 'paused' | 'wrong_host' | 'bot';

const SITE_CACHE_MS = 60_000;
const siteCache = new Map<string, { site: SiteRow | null; expires: number }>();

/** Site by key, cached for 60 seconds per function instance (§7.3). */
async function findSite(repo: Repo, siteKey: string, now: number): Promise<SiteRow | null> {
  const hit = siteCache.get(siteKey);
  if (hit && hit.expires > now) return hit.site;
  const site = await repo.findSiteByKey(siteKey);
  if (siteCache.size > 5000) siteCache.clear();
  siteCache.set(siteKey, { site, expires: now + SITE_CACHE_MS });
  return site;
}

/** For tests: forget cached sites (e.g. after pausing one). */
export function clearSiteCache(): void {
  siteCache.clear();
}

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]', '::1']);

/** The page must be on the site's domain (or a subdomain when enabled) — §7.4. */
export function hostAllowed(
  pageHost: string,
  site: Pick<SiteRow, 'domain' | 'include_subdomains' | 'allow_localhost'>,
): boolean {
  const host = pageHost
    .toLowerCase()
    .replace(/\.$/, '')
    .replace(/^www\./, '');
  if (LOCAL_HOSTS.has(host)) return site.allow_localhost;
  if (host === site.domain) return true;
  return site.include_subdomains && host.endsWith(`.${site.domain}`);
}

/** Parse the text/plain body; anything that isn't a valid payload is null. */
export function parsePayload(body: unknown): CollectPayload | null {
  if (typeof body !== 'string' || body.length === 0 || body.length > 2048) return null;
  try {
    const result = collectPayloadSchema.safeParse(JSON.parse(body));
    return result.success ? result.data : null;
  } catch {
    return null;
  }
}

/**
 * Handle one tracker hit end to end (§7): validate, find the site, check the hostname, drop
 * bots, hash the visitor, then record the page view (one database call that extends or starts
 * the visit). Never stores or logs the IP address or the full user agent.
 */
export async function handleHit(
  repo: Repo,
  body: unknown,
  ctx: CollectContext,
): Promise<HitOutcome> {
  const payload = parsePayload(body);
  if (!payload) return 'invalid';

  let page: URL;
  try {
    page = new URL(payload.u);
  } catch {
    return 'invalid';
  }
  if (page.protocol !== 'http:' && page.protocol !== 'https:') return 'invalid';

  const now = ctx.now ?? new Date();
  const site = await findSite(repo, payload.s, now.getTime());
  if (!site) return 'unknown_site';
  if (site.paused) return 'paused';
  if (!hostAllowed(page.hostname, site)) return 'wrong_host';
  if (isBotUserAgent(ctx.userAgent)) return 'bot';
  const userAgent = ctx.userAgent ?? '';

  const country =
    ctx.country && /^[A-Za-z]{2}$/.test(ctx.country) ? ctx.country.toUpperCase() : 'XX';
  const salt = await getDailySalt(repo, now);
  const source = classify({
    pageUrl: payload.u,
    referrer: payload.r,
    siteDomain: site.domain,
    userAgent,
  });
  const { browser, os } = parseUserAgent(userAgent);

  await repo.recordPageView({
    siteId: site.id,
    visitorHash: visitorHash({ dailySalt: salt, siteId: site.id, ip: ctx.ip, userAgent }),
    at: now.toISOString(),
    path: (page.pathname || '/').slice(0, 500),
    channelId: source.channel,
    platformId: source.platform,
    sourceDetail: source.sourceDetail?.slice(0, 200) ?? null,
    isPaid: source.isPaid,
    referrerHost: source.internal ? null : source.referrerHost,
    utm: source.utm,
    countryCode: country,
    device: deviceFromWidth(payload.w),
    browser,
    os,
  });
  return 'recorded';
}
