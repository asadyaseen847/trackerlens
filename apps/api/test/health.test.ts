import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../src/createApp.js';

describe('GET /api/health', () => {
  it('returns 200 { ok: true }', async () => {
    const res = await request(createApp()).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ ok: true });
    expect(typeof res.body.time).toBe('string');
  });

  it('sends helmet security headers', async () => {
    const res = await request(createApp()).get('/api/health');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['x-powered-by']).toBeUndefined();
  });
});

describe('GET /api/health/db', () => {
  it('answers 503 when Supabase is not configured', async () => {
    // The test environment has no SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY.
    const res = await request(createApp()).get('/api/health/db');
    expect(res.status).toBe(503);
    expect(res.body).toMatchObject({ ok: false, db: 'unreachable' });
  });
});

describe('GET /', () => {
  it('describes the service instead of answering 404', async () => {
    const res = await request(createApp()).get('/');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true, service: 'api', health: '/api/health' });
  });
});

describe('routing', () => {
  it.each(['/api/stats/overview', '/api/sites', '/api/workspace', '/api/social/accounts'])(
    '%s needs a session',
    async (path) => {
      const res = await request(createApp()).get(path);
      expect(res.status).toBe(401);
    },
  );

  it('unknown routes answer JSON 404', async () => {
    const res = await request(createApp()).get('/api/nope');
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: 'Not found' });
  });
});
