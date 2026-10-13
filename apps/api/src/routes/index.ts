import { Router } from 'express';
import type { AppDeps } from '../createApp.js';
import { authRouter } from './auth.js';
import { collectRouter } from './collect.js';
import { cronRouter } from './cron.js';
import { healthRouter } from './health.js';
import { sitesRouter } from './sites.js';
import { socialRouter } from './social.js';
import { statsRouter } from './stats.js';
import { workspaceRouter } from './workspace.js';

/** Everything mounted under /api (BUILD_PROMPT §10). */
export function apiRouter(deps: AppDeps): Router {
  const router = Router();

  router.use('/health', healthRouter(deps));
  router.use('/auth', authRouter(deps));
  router.use('/workspace', workspaceRouter(deps));
  router.use('/sites', sitesRouter(deps));
  router.use('/stats', statsRouter);
  router.use('/social', socialRouter);
  router.use('/cron', cronRouter);
  router.use('/e', collectRouter);

  return router;
}
