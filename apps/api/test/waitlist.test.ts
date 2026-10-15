import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { testApp } from './helpers.js';

async function rows(db: Awaited<ReturnType<typeof testApp>>['db']) {
  const res = await db.query<{ email: string; website: string | null }>(
    'select email, website from waitlist_signups order by created_at',
  );
  return res.rows;
}

describe('POST /api/waitlist', () => {
  it('adds the email, lowercased, without a session', async () => {
    const { app, db } = await testApp();
    const res = await request(app).post('/api/waitlist').send({ email: ' Ana@Example.COM ' });
    expect(res.status).toBe(201);
    expect(res.body).toEqual({ ok: true });
    expect(await rows(db)).toEqual([{ email: 'ana@example.com', website: null }]);
  });

  it('normalizes the website like "Add website"', async () => {
    const { app, db } = await testApp();
    await request(app)
      .post('/api/waitlist')
      .send({ email: 'a@example.com', website: 'https://www.Shop.Example.com/path' })
      .expect(201);
    expect(await rows(db)).toEqual([{ email: 'a@example.com', website: 'shop.example.com' }]);
  });

  it('treats a blank website as none', async () => {
    const { app, db } = await testApp();
    await request(app)
      .post('/api/waitlist')
      .send({ email: 'a@example.com', website: '  ' })
      .expect(201);
    expect(await rows(db)).toEqual([{ email: 'a@example.com', website: null }]);
  });

  it('answers the same for an email already on the list and keeps the first row', async () => {
    const { app, db } = await testApp();
    await request(app)
      .post('/api/waitlist')
      .send({ email: 'a@example.com', website: 'first.com' })
      .expect(201);
    const again = await request(app)
      .post('/api/waitlist')
      .send({ email: 'A@example.com', website: 'second.com' });
    expect(again.status).toBe(201);
    expect(again.body).toEqual({ ok: true });
    expect(await rows(db)).toEqual([{ email: 'a@example.com', website: 'first.com' }]);
  });

  it.each([
    [{ email: 'not-an-email' }, 'Enter a valid email address.'],
    [{}, undefined],
    [{ email: 'a@example.com', website: 'not a domain' }, undefined],
  ])('rejects %j with 400', async (body, message) => {
    const { app, db } = await testApp();
    const res = await request(app).post('/api/waitlist').send(body);
    expect(res.status).toBe(400);
    if (message) expect(res.body.error).toBe(message);
    expect(await rows(db)).toEqual([]);
  });

  it('is rate limited', async () => {
    const { app } = await testApp({ authMax: 2 });
    for (let i = 0; i < 2; i++) {
      await request(app)
        .post('/api/waitlist')
        .send({ email: `a${i}@example.com` })
        .expect(201);
    }
    const res = await request(app).post('/api/waitlist').send({ email: 'a9@example.com' });
    expect(res.status).toBe(429);
  });
});
