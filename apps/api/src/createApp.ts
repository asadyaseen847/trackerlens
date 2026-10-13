import cookieParser from 'cookie-parser';
import express, { type RequestHandler } from 'express';
import helmetImport from 'helmet';
import { loadEnv } from './config/env.js';
import type { Repo } from './db/repo.js';
import { supabaseRepo } from './db/supabaseRepo.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import type { RateLimitOptions } from './middleware/rateLimit.js';
import { collectRouter } from './routes/collect.js';
import { apiRouter } from './routes/index.js';

// helmet ships separate ESM and CommonJS type declarations. Vercel's build typecheck resolves the
// CommonJS ones, where the default import is the module object rather than the function, so accept
// either shape. See docs/decisions.md.
const helmet = (typeof helmetImport === 'function'
  ? helmetImport
  : (helmetImport as unknown as { default: typeof helmetImport })
      .default) as unknown as () => RequestHandler;

export interface AppDeps {
  repo: Repo;
  /** Signup + login attempts per client. */
  authRateLimit: RateLimitOptions;
  /** Tracker hits per client (a safety net; Vercel Firewall is the real limit). */
  collectRateLimit: RateLimitOptions;
  /** Bearer token Vercel Cron sends. Cron routes refuse everything when unset. */
  cronSecret: string | undefined;
  /** Use the deterministic mock social provider (SOCIAL_MOCK=true). */
  socialMock: boolean;
  /** 32-byte key (base64) for encrypting social tokens. A dev-only key is used when unset. */
  encryptionKey: string | undefined;
  /** Public URL of the dashboard, for OAuth redirects. */
  appUrl: string;
}

/**
 * Builds the Express app. Kept separate from index.ts so tests can use it without listening
 * and pass an in-memory Postgres repo. Not named app.ts: Vercel picks src/app.ts as the
 * entrypoint before src/index.ts.
 */
export function createApp(overrides: Partial<AppDeps> = {}) {
  const env = loadEnv();
  const deps: AppDeps = {
    repo: overrides.repo ?? supabaseRepo(),
    authRateLimit: overrides.authRateLimit ?? { windowMs: 60_000, max: 10 },
    collectRateLimit: overrides.collectRateLimit ?? { windowMs: 60_000, max: 300 },
    cronSecret: 'cronSecret' in overrides ? overrides.cronSecret : env.CRON_SECRET,
    socialMock: overrides.socialMock ?? env.SOCIAL_MOCK,
    encryptionKey: 'encryptionKey' in overrides ? overrides.encryptionKey : env.ENCRYPTION_KEY,
    appUrl: overrides.appUrl ?? env.APP_URL,
  };

  const app = express();

  app.disable('x-powered-by');
  app.set('trust proxy', true);

  app.use(helmet());

  // The tracker posts text/plain from any website; it gets its own body parser and CORS.
  app.use('/api/e', collectRouter(deps));

  app.use(express.json({ limit: '100kb' }));
  app.use(cookieParser());

  // The API's own address has no page; say what it is instead of a bare 404.
  app.get('/', (_req, res) => {
    res.json({ ok: true, service: 'api', health: '/api/health' });
  });

  app.use('/api', apiRouter(deps));

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
