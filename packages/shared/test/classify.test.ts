import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { classify, inAppBrowserPlatform, referrerHostOf } from '../src/classify.js';
import { PLATFORMS } from '../src/constants.js';

const SITE = 'shop.example.com';
const page = (query = '') => `https://${SITE}/products/hoodie${query}`;

type Case = [
  name: string,
  input: { url?: string; referrer?: string | null; site?: string },
  expected: {
    channel: string;
    platform: string;
    sourceDetail?: string | null;
    isPaid?: boolean;
    internal?: boolean;
  },
];

const CASES: Case[] = [
  // --- no source at all
  [
    'empty referrer, no UTM → direct',
    { referrer: null },
    { channel: 'direct', platform: 'direct' },
  ],
  ['empty-string referrer → direct', { referrer: '' }, { channel: 'direct', platform: 'direct' }],
  [
    'garbage referrer → direct',
    { referrer: 'not a url' },
    { channel: 'direct', platform: 'direct' },
  ],

  // --- search engines
  [
    'google.com',
    { referrer: 'https://www.google.com/' },
    { channel: 'search', platform: 'google' },
  ],
  [
    'google.co.uk',
    { referrer: 'https://www.google.co.uk/' },
    { channel: 'search', platform: 'google' },
  ],
  [
    'google.com.pk',
    { referrer: 'https://google.com.pk/' },
    { channel: 'search', platform: 'google' },
  ],
  [
    'google.de',
    { referrer: 'https://www.google.de/search?q=x' },
    { channel: 'search', platform: 'google' },
  ],
  [
    'bing.com',
    { referrer: 'https://www.bing.com/search?q=x' },
    { channel: 'search', platform: 'bing' },
  ],
  [
    'duckduckgo.com',
    { referrer: 'https://duckduckgo.com/' },
    { channel: 'search', platform: 'duckduckgo' },
  ],
  [
    'search.yahoo.com',
    { referrer: 'https://search.yahoo.com/search' },
    { channel: 'search', platform: 'yahoo' },
  ],
  ['yahoo.com', { referrer: 'https://www.yahoo.com/' }, { channel: 'search', platform: 'yahoo' }],
  ['yandex.ru', { referrer: 'https://yandex.ru/' }, { channel: 'search', platform: 'yandex' }],
  ['baidu.com', { referrer: 'https://www.baidu.com/' }, { channel: 'search', platform: 'baidu' }],
  [
    'ecosia.org',
    { referrer: 'https://www.ecosia.org/' },
    { channel: 'search', platform: 'ecosia' },
  ],
  [
    'search.brave.com',
    { referrer: 'https://search.brave.com/' },
    { channel: 'search', platform: 'brave' },
  ],

  // --- Google products that are not search (checked before google.*)
  [
    'gemini.google.com is AI, not search',
    { referrer: 'https://gemini.google.com/app' },
    { channel: 'ai', platform: 'gemini' },
  ],
  [
    'mail.google.com is email',
    { referrer: 'https://mail.google.com/mail/u/0/' },
    { channel: 'email', platform: 'gmail' },
  ],
  [
    'mail.yahoo.com is email',
    { referrer: 'https://mail.yahoo.com/' },
    { channel: 'email', platform: 'yahoo-mail' },
  ],
  [
    'not-google lookalike is other',
    { referrer: 'https://notgoogle.com/' },
    { channel: 'other', platform: 'other', sourceDetail: 'notgoogle.com' },
  ],

  // --- social
  [
    'facebook.com',
    { referrer: 'https://www.facebook.com/' },
    { channel: 'social', platform: 'facebook' },
  ],
  [
    'l.facebook.com',
    { referrer: 'https://l.facebook.com/l.php?u=x' },
    { channel: 'social', platform: 'facebook' },
  ],
  [
    'lm.facebook.com',
    { referrer: 'https://lm.facebook.com/' },
    { channel: 'social', platform: 'facebook' },
  ],
  [
    'm.facebook.com',
    { referrer: 'https://m.facebook.com/' },
    { channel: 'social', platform: 'facebook' },
  ],
  ['fb.me', { referrer: 'https://fb.me/abc' }, { channel: 'social', platform: 'facebook' }],
  [
    'instagram.com',
    { referrer: 'https://www.instagram.com/' },
    { channel: 'social', platform: 'instagram' },
  ],
  [
    'l.instagram.com',
    { referrer: 'https://l.instagram.com/?u=x' },
    { channel: 'social', platform: 'instagram' },
  ],
  ['t.co', { referrer: 'https://t.co/abc' }, { channel: 'social', platform: 'x' }],
  ['x.com', { referrer: 'https://x.com/someone' }, { channel: 'social', platform: 'x' }],
  ['twitter.com', { referrer: 'https://twitter.com/' }, { channel: 'social', platform: 'x' }],
  [
    'linkedin.com',
    { referrer: 'https://www.linkedin.com/feed/' },
    { channel: 'social', platform: 'linkedin' },
  ],
  ['lnkd.in', { referrer: 'https://lnkd.in/abc' }, { channel: 'social', platform: 'linkedin' }],
  [
    'tiktok.com',
    { referrer: 'https://www.tiktok.com/' },
    { channel: 'social', platform: 'tiktok' },
  ],
  [
    'youtube.com',
    { referrer: 'https://www.youtube.com/' },
    { channel: 'social', platform: 'youtube' },
  ],
  [
    'm.youtube.com',
    { referrer: 'https://m.youtube.com/watch?v=1' },
    { channel: 'social', platform: 'youtube' },
  ],
  ['youtu.be', { referrer: 'https://youtu.be/abc' }, { channel: 'social', platform: 'youtube' }],
  [
    'old.reddit.com',
    { referrer: 'https://old.reddit.com/r/x' },
    { channel: 'social', platform: 'reddit' },
  ],
  [
    'out.reddit.com',
    { referrer: 'https://out.reddit.com/t3_x' },
    { channel: 'social', platform: 'reddit' },
  ],
  [
    'pinterest.co.uk',
    { referrer: 'https://www.pinterest.co.uk/' },
    { channel: 'social', platform: 'pinterest' },
  ],
  ['pin.it', { referrer: 'https://pin.it/abc' }, { channel: 'social', platform: 'pinterest' }],
  [
    'threads.net',
    { referrer: 'https://www.threads.net/' },
    { channel: 'social', platform: 'threads' },
  ],
  [
    'snapchat.com',
    { referrer: 'https://www.snapchat.com/' },
    { channel: 'social', platform: 'snapchat' },
  ],
  ['quora.com', { referrer: 'https://www.quora.com/' }, { channel: 'social', platform: 'quora' }],
  ['t.me', { referrer: 'https://t.me/channel' }, { channel: 'social', platform: 'telegram' }],
  [
    'web.whatsapp.com',
    { referrer: 'https://web.whatsapp.com/' },
    { channel: 'social', platform: 'whatsapp' },
  ],

  // --- AI assistants
  ['chatgpt.com', { referrer: 'https://chatgpt.com/' }, { channel: 'ai', platform: 'chatgpt' }],
  [
    'chat.openai.com',
    { referrer: 'https://chat.openai.com/' },
    { channel: 'ai', platform: 'chatgpt' },
  ],
  [
    'perplexity.ai',
    { referrer: 'https://www.perplexity.ai/' },
    { channel: 'ai', platform: 'perplexity' },
  ],
  [
    'copilot.microsoft.com',
    { referrer: 'https://copilot.microsoft.com/' },
    { channel: 'ai', platform: 'copilot' },
  ],
  ['claude.ai', { referrer: 'https://claude.ai/chat/1' }, { channel: 'ai', platform: 'claude' }],

  // --- email apps
  [
    'outlook.live.com',
    { referrer: 'https://outlook.live.com/mail/' },
    { channel: 'email', platform: 'outlook' },
  ],
  [
    'outlook.office.com',
    { referrer: 'https://outlook.office.com/' },
    { channel: 'email', platform: 'outlook' },
  ],

  // --- unknown websites
  [
    'unknown site → other with its host',
    { referrer: 'https://news.ycombinator.com/item?id=1' },
    { channel: 'other', platform: 'other', sourceDetail: 'news.ycombinator.com' },
  ],
  [
    'unknown site drops www.',
    { referrer: 'https://www.producthunt.com/posts/x' },
    { channel: 'other', platform: 'other', sourceDetail: 'producthunt.com' },
  ],

  // --- the site's own pages
  [
    'same domain is internal',
    { referrer: `https://${SITE}/` },
    { channel: 'direct', platform: 'direct', internal: true },
  ],
  [
    'own subdomain is internal',
    { referrer: `https://blog.${SITE}/post` },
    { channel: 'direct', platform: 'direct', internal: true },
  ],
  [
    'www. of own domain is internal',
    { referrer: 'https://www.example.com/', site: 'example.com' },
    { channel: 'direct', platform: 'direct', internal: true },
  ],
  [
    'sibling domain is not internal',
    { referrer: 'https://example.com/', site: 'shop.example.com' },
    { channel: 'other', platform: 'other', sourceDetail: 'example.com' },
  ],

  // --- UTM tags override the referrer
  [
    'utm_source=instagram beats a google referrer',
    { url: page('?utm_source=instagram'), referrer: 'https://www.google.com/' },
    { channel: 'social', platform: 'instagram' },
  ],
  ['utm alias ig', { url: page('?utm_source=ig') }, { channel: 'social', platform: 'instagram' }],
  [
    'utm alias insta',
    { url: page('?utm_source=insta') },
    { channel: 'social', platform: 'instagram' },
  ],
  ['utm alias fb', { url: page('?utm_source=fb') }, { channel: 'social', platform: 'facebook' }],
  [
    'utm alias meta',
    { url: page('?utm_source=meta') },
    { channel: 'social', platform: 'facebook' },
  ],
  ['utm alias tw', { url: page('?utm_source=tw') }, { channel: 'social', platform: 'x' }],
  ['utm alias twitter', { url: page('?utm_source=twitter') }, { channel: 'social', platform: 'x' }],
  ['utm alias li', { url: page('?utm_source=li') }, { channel: 'social', platform: 'linkedin' }],
  ['utm alias yt', { url: page('?utm_source=yt') }, { channel: 'social', platform: 'youtube' }],
  ['utm alias tt', { url: page('?utm_source=tt') }, { channel: 'social', platform: 'tiktok' }],
  ['utm alias gpt', { url: page('?utm_source=gpt') }, { channel: 'ai', platform: 'chatgpt' }],
  ['utm alias openai', { url: page('?utm_source=openai') }, { channel: 'ai', platform: 'chatgpt' }],
  [
    'utm source is case-insensitive',
    { url: page('?utm_source=Instagram') },
    { channel: 'social', platform: 'instagram' },
  ],
  [
    'utm newsletter + medium email → email',
    { url: page('?utm_source=newsletter&utm_medium=email') },
    { channel: 'email', platform: 'other', sourceDetail: 'newsletter' },
  ],
  [
    'utm medium newsletter → email',
    { url: page('?utm_source=weekly&utm_medium=newsletter') },
    { channel: 'email', platform: 'other', sourceDetail: 'weekly' },
  ],
  [
    'unknown utm source → other',
    { url: page('?utm_source=podcast') },
    { channel: 'other', platform: 'other', sourceDetail: 'podcast' },
  ],
  [
    'utm on the site with internal referrer still counts',
    { url: page('?utm_source=tiktok'), referrer: `https://${SITE}/` },
    { channel: 'social', platform: 'tiktok' },
  ],

  // --- paid
  [
    'paid: cpc',
    { url: page('?utm_source=google&utm_medium=cpc') },
    { channel: 'search', platform: 'google', isPaid: true },
  ],
  [
    'paid: paid_social',
    { url: page('?utm_source=fb&utm_medium=paid_social') },
    { channel: 'social', platform: 'facebook', isPaid: true },
  ],
  [
    'paid: paidsocial',
    { url: page('?utm_source=tiktok&utm_medium=paidsocial') },
    { channel: 'social', platform: 'tiktok', isPaid: true },
  ],
  [
    'paid: display',
    { url: page('?utm_source=banner&utm_medium=display') },
    { channel: 'other', platform: 'other', sourceDetail: 'banner', isPaid: true },
  ],
  [
    'paid: ads, case-insensitive',
    { url: page('?utm_source=x&utm_medium=ADS') },
    { channel: 'social', platform: 'x', isPaid: true },
  ],
  [
    'not paid: social',
    { url: page('?utm_source=x&utm_medium=social') },
    { channel: 'social', platform: 'x', isPaid: false },
  ],
];

describe('classify (§8)', () => {
  it('has at least 40 cases', () => {
    expect(CASES.length).toBeGreaterThanOrEqual(40);
  });

  it.each(CASES)('%s', (_name, input, expected) => {
    const result = classify({
      pageUrl: input.url ?? page(),
      referrer: input.referrer ?? null,
      siteDomain: input.site ?? SITE,
    });
    expect(result).toMatchObject({
      isPaid: false,
      internal: false,
      sourceDetail: null,
      ...expected,
    });
  });

  it('keeps every UTM value', () => {
    const result = classify({
      pageUrl: page(
        '?utm_source=ig&utm_medium=social&utm_campaign=october-sale&utm_term=hoodie&utm_content=story',
      ),
      referrer: null,
      siteDomain: SITE,
    });
    expect(result.utm).toEqual({
      source: 'ig',
      medium: 'social',
      campaign: 'october-sale',
      term: 'hoodie',
      content: 'story',
    });
  });

  it('reports the referrer host', () => {
    expect(
      classify({ pageUrl: page(), referrer: 'https://www.google.com/x', siteDomain: SITE })
        .referrerHost,
    ).toBe('google.com');
  });
});

describe("social apps' built-in browsers", () => {
  // Real user agents of each app's in-app browser.
  const UA = {
    facebook:
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 [FBAN/FBIOS;FBAV/470.0.0.40.97;FBBV/619182283;FBDV/iPhone15,2;FBMD/iPhone;FBSN/iOS;FBSV/17.5;FBSS/3;FBID/phone;FBLC/en_US;FBOP/5]',
    facebookAndroid:
      'Mozilla/5.0 (Linux; Android 14; Pixel 8 Build/AP2A.240805.005; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/127.0.6533.103 Mobile Safari/537.36 [FB_IAB/FB4A;FBAV/479.0.0.53.105;]',
    instagram:
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 341.0.4.27.92 (iPhone15,2; iOS 17_5; en_US; en; scale=3.00; 1179x2556; 621434925)',
    threads:
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Barcelona 341.0.0.21.94 (iPhone15,2; iOS 17_5; en_US; en-US; scale=3.00; 1179x2556; 621066562)',
    linkedin:
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 [LinkedInApp]/9.30.1840',
    tiktok:
      'Mozilla/5.0 (Linux; Android 14; SM-S918B Build/UP1A.231005.007; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/126.0.6478.134 Mobile Safari/537.36 trill_350401 JsSdk/1.0 NetType/WIFI Channel/googleplay AppName/musical_ly app_version/35.4.1 ByteLocale/en ByteFullLocale/en Region/US BytedanceWebview/d8a21c6',
    snapchat:
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Snapchat/13.3.0.40 (like Safari/8617.2.4.10.8, panda)',
    pinterest:
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 [Pinterest/iOS]',
    x: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Mobile Safari/537.36 TwitterAndroid',
    safari:
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',
  };
  const fromApp = (userAgent: string, extra: { url?: string; referrer?: string } = {}) =>
    classify({
      pageUrl: extra.url ?? page(),
      referrer: extra.referrer ?? null,
      siteDomain: SITE,
      userAgent,
    });

  it.each([
    ['facebook', UA.facebook, 'facebook'],
    ['facebook (Android)', UA.facebookAndroid, 'facebook'],
    ['instagram', UA.instagram, 'instagram'],
    ['threads', UA.threads, 'threads'],
    ['linkedin', UA.linkedin, 'linkedin'],
    ['tiktok', UA.tiktok, 'tiktok'],
    ['snapchat', UA.snapchat, 'snapchat'],
    ['pinterest', UA.pinterest, 'pinterest'],
    ['x', UA.x, 'x'],
  ])('a visit with no referrer from the %s app counts for it', (_name, ua, platform) => {
    expect(fromApp(ua)).toMatchObject({ channel: 'social', platform, sourceDetail: null });
  });

  it('a normal browser with no referrer is still direct', () => {
    expect(fromApp(UA.safari)).toMatchObject({ channel: 'direct', platform: 'direct' });
  });

  it('UTM tags and a real referrer still come first', () => {
    expect(
      fromApp(UA.instagram, { url: page('?utm_source=newsletter&utm_medium=email') }),
    ).toMatchObject({ channel: 'email', platform: 'other', sourceDetail: 'newsletter' });
    expect(fromApp(UA.tiktok, { referrer: 'https://www.google.com/' })).toMatchObject({
      platform: 'google',
    });
  });

  it('clicking between pages inside the app keeps the visit internal', () => {
    expect(fromApp(UA.facebook, { referrer: `https://${SITE}/` })).toMatchObject({
      internal: true,
      platform: 'direct',
    });
  });

  it('inAppBrowserPlatform ignores missing user agents', () => {
    expect(inAppBrowserPlatform(null)).toBeNull();
    expect(inAppBrowserPlatform(UA.safari)).toBeNull();
  });
});

describe('referrerHostOf', () => {
  it('drops www. and m. and lowercases', () => {
    expect(referrerHostOf('https://M.Facebook.com/x')).toBe('facebook.com');
    expect(referrerHostOf('https://www.example.com')).toBe('example.com');
    expect(referrerHostOf(null)).toBeNull();
    expect(referrerHostOf('nonsense')).toBeNull();
  });
});

describe('PLATFORMS matches the database seed', () => {
  it('has the same ids, labels and channels as supabase/migrations', () => {
    const sql = readFileSync(
      new URL('../../../supabase/migrations/20261013000000_initial_schema.sql', import.meta.url),
      'utf8',
    );
    const seed = sql.slice(sql.indexOf('insert into public.platforms'));
    const rows = [...seed.matchAll(/\('([a-z-]+)',\s*'([^']+)',\s*'([a-z]+)',\s*\d+\)/g)].map(
      ([, id, label, channel]) => ({ id, label, channel }),
    );
    expect(rows).toEqual(PLATFORMS.map(({ id, label, channel }) => ({ id, label, channel })));
  });
});
