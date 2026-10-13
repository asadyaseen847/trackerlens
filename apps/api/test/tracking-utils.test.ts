import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { clearSaltCache, getDailySalt } from '../src/services/salt.service.js';
import { visitorHash } from '../src/utils/hash.js';
import { deviceFromWidth, isBotUserAgent, parseUserAgent } from '../src/utils/ua.js';
import { testApp } from './helpers.js';

describe('visitorHash (§7.7)', () => {
  const base = { siteId: 'site-1', ip: '203.0.113.7', userAgent: 'Mozilla/5.0' };

  it('is 16 hex characters and stable for the same day', () => {
    const a = visitorHash({ ...base, dailySalt: 'salt-day-1' });
    expect(a).toMatch(/^[0-9a-f]{16}$/);
    expect(visitorHash({ ...base, dailySalt: 'salt-day-1' })).toBe(a);
  });

  it('changes the next day (new salt), per site, and per visitor', () => {
    const a = visitorHash({ ...base, dailySalt: 'salt-day-1' });
    expect(visitorHash({ ...base, dailySalt: 'salt-day-2' })).not.toBe(a);
    expect(visitorHash({ ...base, dailySalt: 'salt-day-1', siteId: 'site-2' })).not.toBe(a);
    expect(visitorHash({ ...base, dailySalt: 'salt-day-1', ip: '198.51.100.1' })).not.toBe(a);
  });
});

describe('daily salt', () => {
  it('is created once per UTC day and reused', async () => {
    const { repo, db } = await testApp();
    clearSaltCache();
    const day1 = new Date('2026-10-14T01:00:00Z');
    const s1 = await getDailySalt(repo, day1);
    clearSaltCache();
    expect(await getDailySalt(repo, new Date('2026-10-14T23:59:00Z'))).toBe(s1);
    const s2 = await getDailySalt(repo, new Date('2026-10-15T00:00:01Z'));
    expect(s2).not.toBe(s1);
    expect(s1).toMatch(/^[0-9a-f]{64}$/);
    expect((await db.query('select day from salts order by day')).rows).toEqual([
      { day: '2026-10-14' },
      { day: '2026-10-15' },
    ]);
  });
});

describe('user agent helpers', () => {
  it('parses browser and OS names only', () => {
    expect(
      parseUserAgent(
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15',
      ),
    ).toEqual({ browser: 'Safari', os: 'macOS' });
  });

  it('sizes devices by window width', () => {
    expect(deviceFromWidth(390)).toBe('phone');
    expect(deviceFromWidth(767)).toBe('phone');
    expect(deviceFromWidth(768)).toBe('tablet');
    expect(deviceFromWidth(1023)).toBe('tablet');
    expect(deviceFromWidth(1024)).toBe('desktop');
  });

  it('flags bots and missing user agents', () => {
    expect(isBotUserAgent(undefined)).toBe(true);
    expect(isBotUserAgent('')).toBe(true);
    expect(isBotUserAgent('Mozilla/5.0 (compatible; bingbot/2.0)')).toBe(true);
    expect(
      isBotUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/129.0 Safari/537.36'),
    ).toBe(false);
  });
});

describe('cron routes', () => {
  it('refuse requests without the right bearer token', async () => {
    const { app } = await testApp({ cronSecret: 'top-secret' });
    expect((await request(app).get('/api/cron/cleanup-salts')).status).toBe(401);
    expect(
      (await request(app).get('/api/cron/cleanup-salts').set('Authorization', 'Bearer wrong'))
        .status,
    ).toBe(401);
  });

  it('refuse everything when no secret is configured', async () => {
    const { app } = await testApp({ cronSecret: undefined });
    const res = await request(app).get('/api/cron/cleanup-salts').set('Authorization', 'Bearer ');
    expect(res.status).toBe(401);
  });

  it('cleanup-salts deletes salts older than yesterday', async () => {
    const { app, db } = await testApp({ cronSecret: 'top-secret' });
    await db.query(
      `insert into salts (day, value) values
        (current_date - 5, repeat('a', 64)), (current_date - 1, repeat('b', 64)), (current_date, repeat('c', 64))`,
    );
    const res = await request(app)
      .get('/api/cron/cleanup-salts')
      .set('Authorization', 'Bearer top-secret');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true, deleted: 1 });
  });
});
