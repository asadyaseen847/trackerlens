import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { signedInAgent, testApp } from './helpers.js';

const password = 'correct horse battery';

describe('POST /api/auth/signup', () => {
  it('creates the user, a workspace with the timezone, and signs in', async () => {
    const { app, db } = await testApp();
    const res = await request(app)
      .post('/api/auth/signup')
      .send({ name: 'Asad Yaseen', email: 'Asad@Example.com', password, timezone: 'Asia/Karachi' });

    expect(res.status).toBe(201);
    expect(res.body.user).toMatchObject({ email: 'asad@example.com', name: 'Asad Yaseen' });
    expect(res.body.workspace).toMatchObject({
      name: "Asad's workspace",
      timezone: 'Asia/Karachi',
      role: 'owner',
    });

    const cookie = String(res.headers['set-cookie']);
    expect(cookie).toMatch(/session=/);
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/SameSite=Lax/i);

    // Stored hashed, never in plain text.
    const { rows } = await db.query<{ password_hash: string }>('select password_hash from users');
    expect(rows[0]?.password_hash).toMatch(/^\$2[aby]\$/);
    expect(rows[0]?.password_hash).not.toContain(password);
  });

  it('rejects a duplicate email with 409', async () => {
    const { app } = await testApp();
    const body = { name: 'A', email: 'dup@example.com', password };
    await request(app).post('/api/auth/signup').send(body).expect(201);
    const res = await request(app).post('/api/auth/signup').send(body);
    expect(res.status).toBe(409);
    expect(res.body.error).toBe('An account with this email already exists. Log in instead.');
  });

  it('answers 400 with a readable message for bad input', async () => {
    const { app } = await testApp();
    const res = await request(app)
      .post('/api/auth/signup')
      .send({ name: 'A', email: 'a@b.co', password: 'short' });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Use at least 8 characters for your password.');
  });
});

describe('POST /api/auth/login', () => {
  it('signs in with the right password', async () => {
    const { app } = await testApp();
    const { email } = await signedInAgent(app);
    const res = await request(app).post('/api/auth/login').send({ email, password });
    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe(email);
    expect(String(res.headers['set-cookie'])).toMatch(/session=/);
  });

  it('gives the same answer for a wrong password and an unknown email', async () => {
    const { app } = await testApp();
    const { email } = await signedInAgent(app);
    const wrong = await request(app).post('/api/auth/login').send({ email, password: 'nope-nope' });
    const unknown = await request(app)
      .post('/api/auth/login')
      .send({ email: 'ghost@example.com', password });
    expect(wrong.status).toBe(401);
    expect(unknown.status).toBe(401);
    expect(wrong.body).toEqual(unknown.body);
  });

  it('is rate-limited', async () => {
    const { app } = await testApp({ authMax: 2 });
    const attempt = () =>
      request(app).post('/api/auth/login').send({ email: 'x@example.com', password: 'whatever1' });
    expect((await attempt()).status).toBe(401);
    expect((await attempt()).status).toBe(401);
    const third = await attempt();
    expect(third.status).toBe(429);
    expect(third.headers['retry-after']).toBeDefined();
  });
});

describe('GET /api/auth/me and logout', () => {
  it('returns the signed-in user, then 401 after logout', async () => {
    const { app } = await testApp();
    const { agent, email } = await signedInAgent(app);

    const me = await agent.get('/api/auth/me');
    expect(me.status).toBe(200);
    expect(me.body.user.email).toBe(email);

    await agent.post('/api/auth/logout').expect(204);
    expect((await agent.get('/api/auth/me')).status).toBe(401);
  });

  it('rejects requests without a session or with a forged one', async () => {
    const { app } = await testApp();
    expect((await request(app).get('/api/auth/me')).status).toBe(401);
    const forged = await request(app).get('/api/auth/me').set('Cookie', 'session=not.a.jwt');
    expect(forged.status).toBe(401);
  });
});

describe('/api/workspace', () => {
  it('reads and renames the workspace and changes its timezone', async () => {
    const { app } = await testApp();
    const { agent } = await signedInAgent(app);

    const res = await agent.patch('/api/workspace').send({ name: 'Acme', timezone: 'Asia/Seoul' });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ name: 'Acme', timezone: 'Asia/Seoul', role: 'owner' });
    expect((await agent.get('/api/workspace')).body.name).toBe('Acme');
  });

  it('rejects an invalid timezone', async () => {
    const { app } = await testApp();
    const { agent } = await signedInAgent(app);
    const res = await agent.patch('/api/workspace').send({ timezone: 'Mars/Base' });
    expect(res.status).toBe(400);
  });
});
