/**
 * Deterministic demo traffic (BUILD_PROMPT §15): 3 sites, 18 months, weekday patterns, growth,
 * occasional viral spikes, and a channel / platform / country / device mix like the prototype.
 * The same `seed` always produces the same numbers. Visit ids are random UUIDs.
 */
import { randomUUID } from 'node:crypto';

export const DEMO_SITES = [
  { domain: 'mybrand.com', siteKey: 'ws_7Q2K9X' },
  { domain: 'shop.mybrand.com', siteKey: 'ws_4HT8RC' },
  { domain: 'blog.mybrand.com', siteKey: 'ws_9VW3LM' },
] as const;

type Channel = 'social' | 'search' | 'email' | 'ai' | 'direct' | 'other';
type Device = 'phone' | 'tablet' | 'desktop';

export interface DemoVisit {
  id: string;
  site_id: string;
  visitor_hash: string;
  started_at: string;
  last_seen_at: string;
  pageview_count: number;
  entry_path: string;
  exit_path: string;
  channel_id: Channel;
  platform_id: string;
  source_detail: string | null;
  is_paid: boolean;
  referrer_host: string | null;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
  utm_term: null;
  utm_content: null;
  country_code: string;
  device: Device;
  browser: string;
  os: string;
}

export interface DemoPageView {
  visit_id: string;
  site_id: string;
  viewed_at: string;
  path: string;
}

/** Mulberry32: small, fast, deterministic. */
function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pick<T>(r: () => number, items: ReadonlyArray<readonly [T, number]>): T {
  const total = items.reduce((s, [, w]) => s + w, 0);
  let x = r() * total;
  for (const [item, w] of items) {
    x -= w;
    if (x <= 0) return item;
  }
  return items[items.length - 1]![0];
}

// Weekday factors, Sunday first (as in the prototype).
const WEEK: Record<Channel, number[]> = {
  social: [1.12, 0.95, 0.98, 0.97, 0.98, 1, 1.1],
  search: [0.75, 1.08, 1.1, 1.08, 1.05, 1, 0.78],
  email: [0.5, 0.7, 2.4, 1.1, 0.85, 0.7, 0.5],
  ai: [0.8, 1.08, 1.1, 1.08, 1.06, 1, 0.82],
  direct: [0.8, 1.06, 1.08, 1.07, 1.05, 1, 0.82],
  other: [0.9, 1.02, 1.05, 1.04, 1.02, 1, 0.9],
};
const PAGES_PER_VISIT: Record<Channel, number> = {
  social: 1.6,
  search: 2.4,
  email: 2.8,
  ai: 2.6,
  direct: 3.0,
  other: 1.8,
};
const SPIKE: Partial<Record<Channel, number>> = { social: 0.007, other: 0.004 };

interface SiteProfile {
  /** Per channel: [visits per day at the start, yearly growth rate]. */
  mix: Record<Channel, [number, number]>;
  devices: [Device, number][];
  pages: [string, number][];
  social: [string, number][];
}

const PROFILES: SiteProfile[] = [
  {
    mix: {
      social: [30, 0.62],
      search: [60, 0.42],
      email: [12, 0.5],
      ai: [2, 1.1],
      direct: [35, 0.45],
      other: [10, 0.3],
    },
    devices: [
      ['phone', 0.52],
      ['desktop', 0.43],
      ['tablet', 0.05],
    ],
    pages: [
      ['/', 0.3],
      ['/pricing', 0.18],
      ['/features', 0.14],
      ['/sale', 0.11],
      ['/about', 0.07],
      ['/contact', 0.05],
    ],
    social: [
      ['instagram', 0.26],
      ['facebook', 0.2],
      ['x', 0.18],
      ['linkedin', 0.14],
      ['tiktok', 0.1],
      ['youtube', 0.06],
      ['reddit', 0.04],
      ['pinterest', 0.02],
    ],
  },
  {
    mix: {
      social: [35, 0.7],
      search: [20, 0.4],
      email: [8, 0.5],
      ai: [1, 1.0],
      direct: [15, 0.45],
      other: [4, 0.3],
    },
    devices: [
      ['phone', 0.71],
      ['desktop', 0.24],
      ['tablet', 0.05],
    ],
    pages: [
      ['/', 0.24],
      ['/products/hoodie', 0.16],
      ['/collections/new', 0.14],
      ['/cart', 0.1],
      ['/products/cap', 0.08],
      ['/checkout', 0.05],
    ],
    social: [
      ['instagram', 0.42],
      ['facebook', 0.22],
      ['tiktok', 0.2],
      ['x', 0.06],
      ['youtube', 0.04],
      ['linkedin', 0.02],
      ['reddit', 0.02],
      ['pinterest', 0.02],
    ],
  },
  {
    mix: {
      social: [12, 0.55],
      search: [45, 0.5],
      email: [6, 0.45],
      ai: [1.5, 1.2],
      direct: [8, 0.4],
      other: [6, 0.35],
    },
    devices: [
      ['phone', 0.44],
      ['desktop', 0.51],
      ['tablet', 0.05],
    ],
    pages: [
      ['/', 0.16],
      ['/how-we-grew-to-10k', 0.2],
      ['/instagram-tips', 0.15],
      ['/seo-checklist', 0.12],
      ['/newsletter', 0.07],
      ['/about', 0.04],
    ],
    social: [
      ['x', 0.22],
      ['linkedin', 0.2],
      ['reddit', 0.14],
      ['instagram', 0.12],
      ['facebook', 0.1],
      ['youtube', 0.1],
      ['pinterest', 0.08],
      ['tiktok', 0.04],
    ],
  },
];

const SEARCH: [string, number][] = [
  ['google', 0.86],
  ['bing', 0.09],
  ['duckduckgo', 0.05],
];
const AI: [string, number][] = [
  ['chatgpt', 0.62],
  ['perplexity', 0.2],
  ['gemini', 0.12],
  ['copilot', 0.06],
];
const OTHER_SITES: [string, number][] = [
  ['producthunt.com', 0.3],
  ['github.com', 0.22],
  ['medium.com', 0.2],
  ['news.ycombinator.com', 0.28],
];
const COUNTRIES: [string, number][] = [
  ['US', 0.35],
  ['GB', 0.09],
  ['IN', 0.07],
  ['PK', 0.06],
  ['DE', 0.06],
  ['CA', 0.05],
  ['AE', 0.035],
  ['AU', 0.03],
  ['FR', 0.03],
  ['NL', 0.02],
  ['XX', 0.01],
];
const CAMPAIGNS: Record<string, string> = {
  instagram: 'october-sale',
  tiktok: 'new-drop',
  x: 'launch-thread',
  facebook: 'spring-promo',
  linkedin: 'founder-story',
  youtube: 'how-to-video',
};
const REFERRER: Record<string, string> = {
  google: 'google.com',
  bing: 'bing.com',
  duckduckgo: 'duckduckgo.com',
  chatgpt: 'chatgpt.com',
  perplexity: 'perplexity.ai',
  gemini: 'gemini.google.com',
  copilot: 'copilot.microsoft.com',
  instagram: 'l.instagram.com',
  facebook: 'l.facebook.com',
  x: 't.co',
  linkedin: 'linkedin.com',
  tiktok: 'tiktok.com',
  youtube: 'youtube.com',
  reddit: 'reddit.com',
  pinterest: 'pinterest.com',
  gmail: 'mail.google.com',
};
const BROWSERS: Record<Device, [string, string][]> = {
  phone: [
    ['Chrome', 'Android'],
    ['Safari', 'iOS'],
    ['Samsung Internet', 'Android'],
  ],
  tablet: [
    ['Safari', 'iOS'],
    ['Chrome', 'Android'],
  ],
  desktop: [
    ['Chrome', 'Windows'],
    ['Safari', 'macOS'],
    ['Edge', 'Windows'],
    ['Firefox', 'Linux'],
  ],
};

const DAY_MS = 86_400_000;
const hex16 = (r: () => number) =>
  Array.from({ length: 16 }, () => Math.floor(r() * 16).toString(16)).join('');

export interface GenerateOptions {
  /** Site ids, in DEMO_SITES order. */
  siteIds: string[];
  now: Date;
  /** How many days back (default 548 ≈ 18 months). */
  days?: number;
  /** Multiplies every daily count (default 0.5 keeps the free Supabase tier comfortable). */
  scale?: number;
  seed?: number;
  /** Receives rows in batches, so millions of rows never sit in memory at once. */
  onBatch: (visits: DemoVisit[], pageViews: DemoPageView[]) => Promise<void>;
  batchSize?: number;
}

/** Generates the visits and page views. Returns the totals. */
export async function generateDemoTraffic(
  opts: GenerateOptions,
): Promise<{ visits: number; pageViews: number }> {
  const days = opts.days ?? 548;
  const scale = opts.scale ?? 0.5;
  const batchSize = opts.batchSize ?? 1000;
  const r = rng(opts.seed ?? 20261014);
  const nowMs = opts.now.getTime();
  const firstDay = Math.floor(nowMs / DAY_MS) - days + 1;

  let visits: DemoVisit[] = [];
  let pageViews: DemoPageView[] = [];
  let totalVisits = 0;
  let totalPageViews = 0;
  const flush = async (force = false) => {
    if (!force && visits.length < batchSize) return;
    if (visits.length === 0) return;
    await opts.onBatch(visits, pageViews);
    visits = [];
    pageViews = [];
  };

  for (let dayIndex = 0; dayIndex < days; dayIndex++) {
    const dayStart = (firstDay + dayIndex) * DAY_MS;
    const years = dayIndex / 365.25;
    const weekday = new Date(dayStart).getUTCDay();

    for (const [siteIndex, profile] of PROFILES.entries()) {
      const siteId = opts.siteIds[siteIndex];
      if (!siteId) continue;
      // Today's visitors on this site: about 1 in 7 visits is someone coming back the same day.
      const todaysVisitors: string[] = [];
      const visitorHash = () => {
        if (todaysVisitors.length > 0 && r() < 0.14) {
          return todaysVisitors[Math.floor(r() * todaysVisitors.length)]!;
        }
        const hash = hex16(r);
        todaysVisitors.push(hash);
        return hash;
      };
      for (const channel of Object.keys(profile.mix) as Channel[]) {
        const [base, growth] = profile.mix[channel];
        let expected =
          base *
          scale *
          Math.exp(growth * years) *
          WEEK[channel][weekday]! *
          (1 + 0.1 * Math.sin(dayIndex / 11 + siteIndex)) *
          (0.88 + 0.24 * r());
        const spike = SPIKE[channel];
        if (spike && r() < spike) expected *= 2.4 + 2 * r();
        const count = Math.round(expected);

        for (let k = 0; k < count; k++) {
          // Daytime-weighted start: more visits from 08:00 to 23:00 UTC.
          const hour = r() < 0.8 ? 8 + r() * 15 : r() * 24;
          const startedMs = dayStart + Math.floor(hour * 3600_000);
          if (startedMs > nowMs) continue;

          let platform: string;
          let detail: string | null = null;
          let utmSource: string | null = null;
          let utmMedium: string | null = null;
          let utmCampaign: string | null = null;
          if (channel === 'social') platform = pick(r, profile.social);
          else if (channel === 'search') platform = pick(r, SEARCH);
          else if (channel === 'ai') platform = pick(r, AI);
          else if (channel === 'direct') platform = 'direct';
          else if (channel === 'email') {
            if (r() < 0.78) {
              platform = 'other';
              detail = 'newsletter';
              utmSource = 'newsletter';
              utmMedium = 'email';
              utmCampaign = 'weekly-letter';
            } else platform = 'gmail';
          } else {
            platform = 'other';
            detail = pick(r, OTHER_SITES);
          }
          const campaign = CAMPAIGNS[platform];
          if (campaign && r() < 0.3) {
            utmSource = platform;
            utmMedium = 'social';
            utmCampaign = campaign;
          }
          const isPaid = utmMedium === 'social' && r() < 0.15;
          if (isPaid) utmMedium = 'paid_social';

          const device = pick(r, profile.devices);
          const [browser, os] = pick(
            r,
            BROWSERS[device].map((b) => [b, 1] as const),
          );
          const pages = Math.max(
            1,
            Math.round(1 + (PAGES_PER_VISIT[channel] - 1) * -Math.log(1 - r() * 0.999)),
          );
          const id = randomUUID();
          const paths: string[] = [];
          let t = startedMs;
          for (let p = 0; p < pages; p++) {
            const path = pick(r, profile.pages);
            paths.push(path);
            pageViews.push({
              visit_id: id,
              site_id: siteId,
              viewed_at: new Date(t).toISOString(),
              path,
            });
            t += Math.floor(20_000 + r() * 160_000);
          }
          const lastSeen = startedMs + Math.floor((t - startedMs) * 0.9);
          visits.push({
            id,
            site_id: siteId,
            visitor_hash: visitorHash(),
            started_at: new Date(startedMs).toISOString(),
            last_seen_at: new Date(Math.min(lastSeen, nowMs)).toISOString(),
            pageview_count: pages,
            entry_path: paths[0]!,
            exit_path: paths[paths.length - 1]!,
            channel_id: channel,
            platform_id: platform,
            source_detail: detail,
            is_paid: isPaid,
            referrer_host: detail && channel === 'other' ? detail : (REFERRER[platform] ?? null),
            utm_source: utmSource,
            utm_medium: utmMedium,
            utm_campaign: utmCampaign,
            utm_term: null,
            utm_content: null,
            country_code: pick(r, COUNTRIES),
            device,
            browser,
            os,
          });
          totalVisits += 1;
          totalPageViews += pages;
          await flush();
        }
      }
    }
  }
  await flush(true);
  return { visits: totalVisits, pageViews: totalPageViews };
}
