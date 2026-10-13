import request from 'supertest';
import { beforeAll, describe, expect, it } from 'vitest';
import { seedDemo, type SeedResult } from './seedPglite.js';
import { signedInAgent, testApp } from './helpers.js';

type Ctx = Awaited<ReturnType<typeof testApp>>;

let ctx: Ctx;
let seed: SeedResult;
let agent: request.Agent;

// 90 days of demo traffic, ending "now" (stats compare against the real clock).
beforeAll(async () => {
  ctx = await testApp();
  seed = await seedDemo(ctx.db, { days: 90, scale: 0.3 });
  agent = request.agent(ctx.app);
  const login = await agent
    .post('/api/auth/login')
    .send({ email: seed.email, password: seed.password });
  expect(login.status).toBe(200);
}, 120_000);

const one = async <T>(sql: string, params: unknown[] = []) =>
  (await ctx.db.query<T>(sql, params)).rows[0]!;

describe('GET /api/stats/overview on seeded data', () => {
  it('returns KPIs that match the database exactly', async () => {
    const res = await agent.get('/api/stats/overview?period=daily');
    expect(res.status).toBe(200);
    const { range, kpis, series, hasData } = res.body;
    expect(hasData).toBe(true);

    // Numbers cover whole local days (the demo data has a few page views just after "now").
    const truth = await one<{ visits: number; visitors: number; pageviews: number }>(
      `with r as (select ($1::timestamptz at time zone $3)::date as d1,
                         (($2::timestamptz - interval '1 ms') at time zone $3)::date as d2)
       select
         (select count(*)::int from visits, r
           where (started_at at time zone $3)::date between d1 and d2) as visits,
         -- The visitor hash changes daily, so visitors are unique per local day, summed.
         (select count(distinct ((started_at at time zone $3)::date, visitor_hash))::int from visits, r
           where (started_at at time zone $3)::date between d1 and d2) as visitors,
         (select count(*)::int from page_views, r
           where (viewed_at at time zone $3)::date between d1 and d2) as pageviews`,
      [range.start, range.end, 'Asia/Karachi'],
    );
    expect(kpis.visits.value).toBe(truth.visits);
    expect(kpis.visitors.value).toBe(truth.visitors);
    expect(kpis.pageviews.value).toBe(truth.pageviews);
    expect(kpis.visits.value).toBeGreaterThan(0);

    // Splitting by device adds up to the total.
    let byDevice = 0;
    for (const device of ['phone', 'tablet', 'desktop']) {
      const r = (await agent.get(`/api/stats/overview?period=daily&device=${device}`)).body;
      byDevice += r.kpis.visits.value;
    }
    expect(byDevice).toBe(truth.visits);

    // The chart adds up to the KPI, and only today is partial.
    expect(series).toHaveLength(30);
    const sum = series.reduce(
      (s: number, b: { byChannel: Record<string, number> }) =>
        s + Object.values(b.byChannel).reduce((a, v) => a + v, 0),
      0,
    );
    expect(sum).toBe(kpis.visits.value);
    expect(series.filter((b: { partial: boolean }) => b.partial)).toHaveLength(1);
  });

  it.each(['weekly', 'monthly', 'yearly'])(
    '%s returns buckets and a comparison',
    async (period) => {
      const res = await agent.get(`/api/stats/overview?period=${period}`);
      expect(res.status).toBe(200);
      expect(res.body.series.length).toBeGreaterThan(0);
      expect(res.body.compareLabel).toBeTruthy();
      expect(res.body.series.at(-1).partial).toBe(true);
    },
  );

  it('applies channel, device and country filters to every number', async () => {
    const all = (await agent.get('/api/stats/overview')).body;
    const social = (await agent.get('/api/stats/overview?channels=social')).body;
    const socialPhonesUs = (
      await agent.get('/api/stats/overview?channels=social&device=phone&country=US')
    ).body;
    expect(social.kpis.visits.value).toBeLessThan(all.kpis.visits.value);
    expect(socialPhonesUs.kpis.visits.value).toBeLessThan(social.kpis.visits.value);
    for (const bucket of social.series) {
      expect(bucket.byChannel.search).toBe(0);
    }
    const truth = await one<{ n: number }>(
      `select count(*)::int as n from visits
       where channel_id = 'social' and device = 'phone' and country_code = 'US'
         and started_at >= $1 and started_at < $2`,
      [socialPhonesUs.range.start, socialPhonesUs.range.end],
    );
    expect(socialPhonesUs.kpis.visits.value).toBe(truth.n);
  });

  it('can show one site', async () => {
    const res = await agent.get(`/api/stats/overview?site=${seed.siteIds[1]}`);
    const truth = await one<{ n: number }>(
      'select count(*)::int as n from visits where site_id = $1 and started_at >= $2 and started_at < $3',
      [seed.siteIds[1], res.body.range.start, res.body.range.end],
    );
    expect(res.body.kpis.visits.value).toBe(truth.n);
  });

  it('rejects bad filters', async () => {
    expect((await agent.get('/api/stats/overview?period=hourly')).status).toBe(400);
    expect((await agent.get('/api/stats/overview?channels=tv')).status).toBe(400);
    expect((await agent.get('/api/stats/overview?country=USA')).status).toBe(400);
  });
});

describe('GET /api/stats/breakdown', () => {
  it.each(['platform', 'page', 'campaign', 'country', 'device'])(
    '%s rows are sorted with shares',
    async (dimension) => {
      const res = await agent.get(`/api/stats/breakdown?dimension=${dimension}&limit=10`);
      expect(res.status).toBe(200);
      const rows = res.body.rows as Array<{ value: number; share: number; label: string }>;
      expect(rows.length).toBeGreaterThan(0);
      expect(rows.length).toBeLessThanOrEqual(10);
      for (let i = 1; i < rows.length; i++)
        expect(rows[i - 1]!.value).toBeGreaterThanOrEqual(rows[i]!.value);
      const shares = rows.reduce((s, r) => s + r.share, 0);
      expect(shares).toBeLessThanOrEqual(1.000001);
      for (const r of rows) expect(r.label).toBeTruthy();
    },
  );

  it('labels platforms and shows unknown sites by host', async () => {
    const rows = (await agent.get('/api/stats/breakdown?dimension=platform&limit=50')).body
      .rows as Array<{
      key: string;
      label: string;
      channel: string;
    }>;
    expect(rows.find((r) => r.key === 'google')).toMatchObject({
      label: 'Google',
      channel: 'search',
    });
    expect(rows.find((r) => r.key === 'other:github.com')).toMatchObject({
      label: 'github.com',
      channel: 'other',
    });
  });

  it('pages count page views and carry the domain', async () => {
    const rows = (await agent.get('/api/stats/breakdown?dimension=page')).body.rows;
    expect(rows[0].detail).toMatch(/mybrand\.com$/);
    expect(rows[0].label.startsWith('/')).toBe(true);
  });
});

describe('live, CSV and site cards', () => {
  it('counts visitors seen in the last 5 minutes', async () => {
    await ctx.db.query(
      `update visits set last_seen_at = now() - interval '1 minute'
       where id in (select id from visits where started_at <= now() - interval '1 minute'
                    order by started_at desc limit 3)`,
    );
    const res = await agent.get('/api/stats/live');
    expect(res.status).toBe(200);
    expect(res.body.count).toBeGreaterThanOrEqual(1);
  });

  it('exports one CSV row per bucket and channel', async () => {
    const res = await agent.get('/api/stats/export.csv?period=daily');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('text/csv');
    const lines = res.text.trim().split('\r\n');
    expect(lines[0]).toBe('bucket_start,period,channel,visits');
    expect(lines).toHaveLength(1 + 30 * 6);
  });

  it('site cards have 30-day visits and a 14-day sparkline', async () => {
    const sites = (await agent.get('/api/sites')).body.sites;
    expect(sites).toHaveLength(3);
    for (const s of sites) {
      expect(s.visits30d).toBeGreaterThan(0);
      expect(s.sparkline).toHaveLength(14);
      expect(s.status).toBe('live');
    }
  });
});

describe('stats are scoped to the workspace', () => {
  it("another workspace sees zero and can't query the demo sites", async () => {
    const other = await signedInAgent(ctx.app, 'Mallory');
    const overview = await other.agent.get('/api/stats/overview');
    expect(overview.body.kpis.visits.value).toBe(0);
    expect(overview.body.hasData).toBe(false);
    expect((await other.agent.get(`/api/stats/overview?site=${seed.siteIds[0]}`)).status).toBe(404);
    expect(
      (await other.agent.get(`/api/stats/breakdown?dimension=page&site=${seed.siteIds[0]}`)).status,
    ).toBe(404);
    expect((await request(ctx.app).get('/api/stats/overview')).status).toBe(401);
  });
});
