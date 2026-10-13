import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { clearSiteCache, hostAllowed } from '../src/services/collect.service.js';
import { clearSaltCache } from '../src/services/salt.service.js';
import { addSite, signedInAgent, testApp } from './helpers.js';

const CHROME =
  'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Mobile Safari/537.36';

type App = Awaited<ReturnType<typeof testApp>>['app'];
type Db = Awaited<ReturnType<typeof testApp>>['db'];

function hit(
  app: App,
  payload: Record<string, unknown> | string,
  headers: Record<string, string> = {},
) {
  const req = request(app)
    .post('/api/e')
    .set('Content-Type', 'text/plain')
    .set('User-Agent', CHROME)
    .set('X-Forwarded-For', '203.0.113.7')
    .set('X-Vercel-IP-Country', 'pk');
  for (const [k, v] of Object.entries(headers)) req.set(k, v);
  return req.send(typeof payload === 'string' ? payload : JSON.stringify(payload));
}

async function setup() {
  const ctx = await testApp();
  const { agent } = await signedInAgent(ctx.app);
  const site = await addSite(agent, 'shop.example.com');
  const pv = (u: string, r: string | null = null, w = 400) => ({ s: site.siteKey, u, r, w });
  return { ...ctx, agent, site, pv };
}

const rows = async <T>(db: Db, sql: string) => (await db.query<T>(sql)).rows;

beforeEach(() => {
  clearSiteCache();
  clearSaltCache();
});

describe('POST /api/e', () => {
  it('records a visit and a page view, and answers 202 with CORS headers', async () => {
    const { app, db, pv } = await setup();
    const res = await hit(
      app,
      pv(
        'https://shop.example.com/pricing?utm_source=ig&utm_campaign=october-sale',
        'https://l.instagram.com/',
      ),
    );

    expect(res.status).toBe(202);
    expect(res.text).toBe('');
    expect(res.headers['access-control-allow-origin']).toBe('*');

    const visits = await rows<Record<string, unknown>>(db, 'select * from visits');
    expect(visits).toHaveLength(1);
    expect(visits[0]).toMatchObject({
      channel_id: 'social',
      platform_id: 'instagram',
      utm_source: 'ig',
      utm_campaign: 'october-sale',
      entry_path: '/pricing',
      country_code: 'PK',
      device: 'phone',
      browser: 'Chrome',
      os: 'Android',
      pageview_count: 1,
    });
    expect(visits[0]?.visitor_hash).toMatch(/^[0-9a-f]{16}$/);

    const pageViews = await rows<{ path: string }>(db, 'select path from page_views');
    expect(pageViews).toEqual([{ path: '/pricing' }]);
  });

  it('never stores the IP address or the full user agent', async () => {
    const { app, db, pv } = await setup();
    await hit(app, pv('https://shop.example.com/'));
    const dump = JSON.stringify([
      ...(await rows(db, 'select * from visits')),
      ...(await rows(db, 'select * from page_views')),
      ...(await rows(db, 'select * from sites')),
    ]);
    expect(dump).not.toContain('203.0.113.7');
    expect(dump).not.toContain('Pixel 8');
  });

  it('continues the same visit within 30 minutes; internal clicks keep the source', async () => {
    const { app, db, pv } = await setup();
    await hit(app, pv('https://shop.example.com/', 'https://www.google.com/'));
    await hit(app, pv('https://shop.example.com/products/hoodie', 'https://shop.example.com/'));

    const visits = await rows<{ platform_id: string; pageview_count: number; exit_path: string }>(
      db,
      'select platform_id, pageview_count, exit_path from visits',
    );
    expect(visits).toEqual([
      { platform_id: 'google', pageview_count: 2, exit_path: '/products/hoodie' },
    ]);
    expect(await rows(db, 'select 1 from page_views')).toHaveLength(2);
  });

  it('treats a different visitor (IP) as a different visit', async () => {
    const { app, db, pv } = await setup();
    await hit(app, pv('https://shop.example.com/'));
    await hit(app, pv('https://shop.example.com/'), { 'X-Forwarded-For': '198.51.100.9' });
    expect(await rows(db, 'select 1 from visits')).toHaveLength(2);
  });

  it('keeps the daily rollup equal to a rebuild from the raw rows', async () => {
    const { app, db, site, pv } = await setup();
    await hit(app, pv('https://shop.example.com/', 'https://www.google.com/'));
    await hit(app, pv('https://shop.example.com/a', 'https://shop.example.com/'));
    await hit(app, pv('https://shop.example.com/', 'https://l.instagram.com/'), {
      'X-Forwarded-For': '198.51.100.9',
    });
    const read = async () => ({
      stats: await rows(db, 'select * from daily_stats order by channel_id'),
      totals: await rows(db, 'select * from daily_totals order by channel_id'),
      pages: await rows(db, 'select * from daily_page_stats order by path, channel_id'),
      pageTotals: await rows(db, 'select * from daily_page_totals order by path'),
    });
    const live = await read();
    expect(live.totals).toMatchObject([
      { channel_id: 'search', visits: 1, visitors: 1, pageviews: 2 },
      { channel_id: 'social', visits: 1, visitors: 1, pageviews: 1 },
    ]);
    expect(live.pageTotals).toMatchObject([
      { path: '/', pageviews: 2 },
      { path: '/a', pageviews: 1 },
    ]);
    await db.query('select rebuild_daily_stats($1::uuid[])', [[site.id]]);
    expect(await read()).toEqual(live);
  });

  it('marks the site live and remembers the first visit', async () => {
    const { app, agent, site, pv } = await setup();
    expect((await agent.get(`/api/sites/${site.id}/status`)).body).toEqual({
      installed: false,
      lastEventAt: null,
    });
    await hit(app, pv('https://shop.example.com/'));
    const status = await agent.get(`/api/sites/${site.id}/status`);
    expect(status.body.installed).toBe(true);
    expect(typeof status.body.lastEventAt).toBe('string');
    expect((await agent.get(`/api/sites/${site.id}`)).body.status).toBe('live');
  });

  it.each([
    ['another website', 'https://evil.example.org/'],
    ['the parent domain', 'https://example.com/'],
    ['a subdomain while subdomains are off', 'https://blog.shop.example.com/'],
    ['localhost while localhost is off', 'http://localhost:3000/'],
  ])('drops hits from %s', async (_label, url) => {
    const { app, db, pv } = await setup();
    const res = await hit(app, pv(url));
    expect(res.status).toBe(202);
    expect(await rows(db, 'select 1 from visits')).toHaveLength(0);
  });

  it('accepts subdomains and localhost when those settings are on', async () => {
    const { app, agent, db, site, pv } = await setup();
    await agent
      .patch(`/api/sites/${site.id}`)
      .send({ includeSubdomains: true, allowLocalhost: true });
    clearSiteCache();
    await hit(app, pv('https://blog.shop.example.com/'));
    await hit(app, pv('http://localhost:3000/'), { 'X-Forwarded-For': '198.51.100.1' });
    expect(await rows(db, 'select 1 from visits')).toHaveLength(2);
  });

  it('accepts www. of the domain', async () => {
    const { app, db, pv } = await setup();
    await hit(app, pv('https://www.shop.example.com/'));
    expect(await rows(db, 'select 1 from visits')).toHaveLength(1);
  });

  it('drops bots and requests without a user agent', async () => {
    const { app, db, pv } = await setup();
    await hit(app, pv('https://shop.example.com/'), {
      'User-Agent': 'Googlebot/2.1 (+http://www.google.com/bot.html)',
    });
    await request(app)
      .post('/api/e')
      .set('Content-Type', 'text/plain')
      .send(JSON.stringify(pv('https://shop.example.com/')));
    expect(await rows(db, 'select 1 from visits')).toHaveLength(0);
  });

  it('drops hits for a paused site', async () => {
    const { app, agent, db, site, pv } = await setup();
    await agent.patch(`/api/sites/${site.id}`).send({ paused: true });
    clearSiteCache();
    expect((await hit(app, pv('https://shop.example.com/'))).status).toBe(202);
    expect(await rows(db, 'select 1 from visits')).toHaveLength(0);
  });

  it.each([
    ['not JSON', 'hello'],
    [
      'an unknown site key',
      JSON.stringify({ s: 'ws_ZZZZZZ', u: 'https://shop.example.com/', r: null, w: 400 }),
    ],
    [
      'a malformed site key',
      JSON.stringify({ s: 'nope', u: 'https://shop.example.com/', r: null, w: 400 }),
    ],
    [
      'a non-http page',
      JSON.stringify({ s: 'ws_ZZZZZZ', u: 'ftp://shop.example.com/', r: null, w: 400 }),
    ],
    [
      'extra fields',
      JSON.stringify({ s: 'ws_ZZZZZZ', u: 'https://shop.example.com/', r: null, w: 400, x: 1 }),
    ],
    [
      'a body over 2 KB',
      JSON.stringify({
        s: 'ws_ZZZZZZ',
        u: `https://shop.example.com/${'a'.repeat(3000)}`,
        r: null,
        w: 1,
      }),
    ],
  ])('answers 202 and drops %s', async (_label, body) => {
    const { app, db } = await setup();
    const res = await hit(app, body);
    expect(res.status).toBe(202);
    expect(await rows(db, 'select 1 from visits')).toHaveLength(0);
  });

  it('answers the CORS preflight', async () => {
    const { app } = await testApp();
    const res = await request(app).options('/api/e').set('Origin', 'https://shop.example.com');
    expect(res.status).toBe(204);
    expect(res.headers['access-control-allow-methods']).toContain('POST');
  });

  it('uses XX when the country is unknown and sizes devices by width', async () => {
    const { app, db, site } = await setup();
    const send = (w: number, ip: string) =>
      request(app)
        .post('/api/e')
        .set('Content-Type', 'text/plain')
        .set('User-Agent', CHROME)
        .set('X-Forwarded-For', ip)
        .send(JSON.stringify({ s: site.siteKey, u: 'https://shop.example.com/', r: null, w }));
    await send(500, '10.0.0.1');
    await send(800, '10.0.0.2');
    await send(1440, '10.0.0.3');
    const found = await rows<{ device: string; country_code: string }>(
      db,
      'select device, country_code from visits order by device',
    );
    expect(found).toEqual([
      { device: 'phone', country_code: 'XX' },
      { device: 'tablet', country_code: 'XX' },
      { device: 'desktop', country_code: 'XX' },
    ]);
  });
});

describe('hostAllowed', () => {
  const site = { domain: 'shop.example.com', include_subdomains: false, allow_localhost: false };
  it('matches the domain, www. and (when enabled) subdomains', () => {
    expect(hostAllowed('shop.example.com', site)).toBe(true);
    expect(hostAllowed('WWW.Shop.Example.com', site)).toBe(true);
    expect(hostAllowed('a.shop.example.com', site)).toBe(false);
    expect(hostAllowed('a.shop.example.com', { ...site, include_subdomains: true })).toBe(true);
    expect(hostAllowed('notshop.example.com', { ...site, include_subdomains: true })).toBe(false);
    expect(hostAllowed('127.0.0.1', { ...site, allow_localhost: true })).toBe(true);
  });
});
