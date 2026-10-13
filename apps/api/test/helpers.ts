import request from 'supertest';
import { createApp, type AppDeps } from '../src/createApp.js';
import { freshDatabase, pgliteRepo } from './pgliteRepo.js';

/** A fresh app on an empty Postgres (PGlite, all migrations applied). */
export async function testApp(options: { authMax?: number } & Partial<AppDeps> = {}) {
  const repo = pgliteRepo(await freshDatabase());
  const app = createApp({
    repo,
    authRateLimit: { windowMs: 60_000, max: options.authMax ?? 1000 },
    ...options,
  });
  return { app, repo, db: repo.db };
}

let counter = 0;

/** Signs up a new user and returns an agent that keeps their session cookie. */
export async function signedInAgent(app: ReturnType<typeof createApp>, name = 'Test User') {
  const agent = request.agent(app);
  const email = `user${++counter}@example.com`;
  const res = await agent
    .post('/api/auth/signup')
    .send({ name, email, password: 'correct horse battery', timezone: 'Asia/Karachi' });
  if (res.status !== 201) {
    throw new Error(`signup failed: ${res.status} ${JSON.stringify(res.body)}`);
  }
  return {
    agent,
    email,
    me: res.body as { user: { id: string }; workspace: { id: string } },
  };
}

/** Adds a site through the API and returns it. */
export async function addSite(agent: request.Agent, domain: string) {
  const res = await agent.post('/api/sites').send({ domain });
  if (res.status !== 201)
    throw new Error(`add site failed: ${res.status} ${JSON.stringify(res.body)}`);
  return res.body as { id: string; domain: string; siteKey: string };
}
