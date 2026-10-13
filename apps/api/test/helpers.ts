import request from 'supertest';
import { createApp } from '../src/createApp.js';
import { memoryRepo } from './memoryRepo.js';

/** A fresh app on an empty in-memory database, with a generous auth rate limit. */
export function testApp(options: { authMax?: number } = {}) {
  const repo = memoryRepo();
  const app = createApp({
    repo,
    authRateLimit: { windowMs: 60_000, max: options.authMax ?? 1000 },
  });
  return { app, repo };
}

let counter = 0;

/** Signs up a new user and returns an agent that keeps their session cookie. */
export async function signedInAgent(app: ReturnType<typeof createApp>, name = 'Test User') {
  const agent = request.agent(app);
  const email = `user${++counter}@example.com`;
  const res = await agent
    .post('/api/auth/signup')
    .send({ name, email, password: 'correct horse battery', timezone: 'Asia/Karachi' });
  if (res.status !== 201)
    throw new Error(`signup failed: ${res.status} ${JSON.stringify(res.body)}`);
  return { agent, email, me: res.body as { user: { id: string }; workspace: { id: string } } };
}
