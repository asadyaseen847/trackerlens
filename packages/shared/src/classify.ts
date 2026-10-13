import { PLATFORMS } from './constants.js';
import type { Channel, Utm } from './types.js';

export interface ClassifyInput {
  /** Full page URL, including the query string. */
  pageUrl: string;
  /** document.referrer, or null. */
  referrer: string | null;
  /** The site's normalized domain, e.g. "shop.example.com". */
  siteDomain: string;
}

export interface ClassifyResult {
  channel: Channel;
  /** A known platform id (see PLATFORMS), "direct", or "other". */
  platform: string;
  /** For platform "other": the referring host or the raw utm_source, shown instead of a name. */
  sourceDetail: string | null;
  isPaid: boolean;
  referrerHost: string | null;
  utm: Utm;
  /** The referrer was the site itself (or a subdomain); it never starts a new source. */
  internal: boolean;
}

const CHANNEL_OF = new Map(PLATFORMS.map((p) => [p.id, p.channel]));

const PAID_MEDIUMS = new Set(['cpc', 'ppc', 'paid', 'paid_social', 'paidsocial', 'display', 'ads']);

/** utm_source aliases → platform id (§8). */
const SOURCE_ALIASES: Readonly<Record<string, string>> = {
  ig: 'instagram',
  insta: 'instagram',
  fb: 'facebook',
  meta: 'facebook',
  tw: 'x',
  twitter: 'x',
  li: 'linkedin',
  yt: 'youtube',
  tt: 'tiktok',
  gpt: 'chatgpt',
  openai: 'chatgpt',
};

/** "example.com" matches example.com and any subdomain of it. */
const domainRule =
  (...domains: string[]) =>
  (host: string) =>
    domains.some((d) => host === d || host.endsWith(`.${d}`));

/** "google.*": the brand label followed by any public suffix (google.com, google.co.uk, ...). */
const anyTld = (brand: string) => {
  const re = new RegExp(`(^|\\.)${brand}\\.[a-z]{2,3}(\\.[a-z]{2})?$`);
  return (host: string) => re.test(host);
};

/**
 * Referrer host rules, checked in order (§8). More specific hosts come first:
 * gemini.google.com and mail.google.com before google.*, mail.yahoo.com before yahoo.com.
 */
const HOST_RULES: ReadonlyArray<[platform: string, matches: (host: string) => boolean]> = [
  ['gemini', domainRule('gemini.google.com')],
  ['gmail', domainRule('mail.google.com')],
  ['yahoo-mail', domainRule('mail.yahoo.com')],
  ['google', anyTld('google')],
  ['bing', domainRule('bing.com')],
  ['duckduckgo', domainRule('duckduckgo.com')],
  ['yahoo', domainRule('search.yahoo.com', 'yahoo.com')],
  ['yandex', anyTld('yandex')],
  ['baidu', domainRule('baidu.com')],
  ['ecosia', domainRule('ecosia.org')],
  ['brave', domainRule('search.brave.com')],
  ['facebook', domainRule('facebook.com', 'fb.com', 'fb.me')],
  ['instagram', domainRule('instagram.com')],
  ['x', domainRule('t.co', 'x.com', 'twitter.com')],
  ['linkedin', domainRule('linkedin.com', 'lnkd.in')],
  ['tiktok', domainRule('tiktok.com')],
  ['youtube', domainRule('youtube.com', 'youtu.be')],
  ['reddit', domainRule('reddit.com')],
  ['pinterest', (h) => anyTld('pinterest')(h) || domainRule('pin.it')(h)],
  ['threads', domainRule('threads.net', 'threads.com')],
  ['snapchat', domainRule('snapchat.com')],
  ['quora', domainRule('quora.com')],
  ['telegram', domainRule('t.me', 'web.telegram.org')],
  ['whatsapp', domainRule('wa.me', 'web.whatsapp.com', 'whatsapp.com')],
  ['chatgpt', domainRule('chatgpt.com', 'chat.openai.com')],
  ['perplexity', domainRule('perplexity.ai')],
  ['copilot', domainRule('copilot.microsoft.com')],
  ['claude', domainRule('claude.ai')],
  ['outlook', domainRule('outlook.live.com', 'outlook.office.com', 'outlook.office365.com')],
];

/** Lowercase host without "www." or "m.", or null if the value isn't a URL. */
export function referrerHostOf(url: string | null): string | null {
  if (!url) return null;
  try {
    const host = new URL(url).hostname.toLowerCase().replace(/\.$/, '');
    return host.replace(/^(www|m)\./, '') || null;
  } catch {
    return null;
  }
}

function isInternal(host: string, siteDomain: string): boolean {
  return host === siteDomain || host.endsWith(`.${siteDomain}`);
}

function readUtm(pageUrl: string): Utm {
  let params: URLSearchParams;
  try {
    params = new URL(pageUrl).searchParams;
  } catch {
    return {};
  }
  const utm: Utm = {};
  for (const key of ['source', 'medium', 'campaign', 'term', 'content'] as const) {
    const value = params.get(`utm_${key}`)?.trim().slice(0, 200);
    if (value) utm[key] = value;
  }
  return utm;
}

/**
 * Work out where a visit came from, applying §8 in order:
 * UTM tags → referrer host → direct.
 */
export function classify({ pageUrl, referrer, siteDomain }: ClassifyInput): ClassifyResult {
  const utm = readUtm(pageUrl);
  const medium = utm.medium?.toLowerCase();
  const isPaid = medium !== undefined && PAID_MEDIUMS.has(medium);
  const referrerHost = referrerHostOf(referrer);
  const base = { isPaid, referrerHost, utm, internal: false };

  // 1. Campaign tags win over the referrer.
  if (utm.source) {
    const raw = utm.source.toLowerCase();
    const platform = SOURCE_ALIASES[raw] ?? raw;
    const channel = CHANNEL_OF.get(platform);
    if (channel && platform !== 'other' && platform !== 'direct') {
      return { ...base, channel, platform, sourceDetail: null };
    }
    const tagChannel: Channel = medium === 'email' || medium === 'newsletter' ? 'email' : 'other';
    return { ...base, channel: tagChannel, platform: 'other', sourceDetail: utm.source };
  }

  // 2. Then where the browser says the visitor came from.
  if (referrerHost) {
    if (isInternal(referrerHost, siteDomain)) {
      return { ...base, channel: 'direct', platform: 'direct', sourceDetail: null, internal: true };
    }
    for (const [platform, matches] of HOST_RULES) {
      if (matches(referrerHost)) {
        return {
          ...base,
          channel: CHANNEL_OF.get(platform) ?? 'other',
          platform,
          sourceDetail: null,
        };
      }
    }
    return { ...base, channel: 'other', platform: 'other', sourceDetail: referrerHost };
  }

  // 3. No tags and no referrer: typed in, bookmarked, or an app that hides the referrer.
  return { ...base, channel: 'direct', platform: 'direct', sourceDetail: null };
}
