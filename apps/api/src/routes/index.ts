import { Router } from 'express';
import { authRouter } from './auth.js';
import { collectRouter } from './collect.js';
import { cronRouter } from './cron.js';
import { healthRouter } from './health.js';
import { sitesRouter } from './sites.js';
import { socialRouter } from './social.js';
import { statsRouter } from './stats.js';
import { workspaceRouter } from './workspace.js';

/** Everything mounted under /api (BUILD_PROMPT §10). */
export const apiRouter = Router();

apiRouter.use('/health', healthRouter);
apiRouter.use('/auth', authRouter);
apiRouter.use('/workspace', workspaceRouter);
apiRouter.use('/sites', sitesRouter);
apiRouter.use('/stats', statsRouter);
apiRouter.use('/social', socialRouter);
apiRouter.use('/cron', cronRouter);
apiRouter.use('/e', collectRouter);
