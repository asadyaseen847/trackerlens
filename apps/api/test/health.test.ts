import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';

describe('GET /api/health', () => {
  it('returns 200 { ok: true }', async () => {
    const res = await request(createApp()).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ ok: true });
    expect(typeof res.body.time).toBe('string');
  });
});

describe('placeholder routes', () => {
  it('answer 501 with the phase that builds them', async () => {
    const res = await request(createApp()).get('/api/stats/overview');
    expect(res.status).toBe(501);
    expect(res.body).toEqual({ error: 'Not implemented', phase: 3 });
  });

  it('unknown routes answer JSON 404', async () => {
    const res = await request(createApp()).get('/api/nope');
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: 'Not found' });
  });
});
