import { timingSafeEqual } from 'node:crypto';
import { Router, type RequestHandler } from 'express';
import type { AppDeps } from '../createApp.js';
import { cleanupSalts } from '../services/salt.service.js';
import { syncAllAccounts } from '../social/sync.js';
import { HttpError } from '../utils/httpError.js';
import { logger } from '../utils/logger.js';

/** Vercel Cron sends "Authorization: Bearer <CRON_SECRET>" (§4). Constant-time compare. */
function requireCronSecret(secret: string | undefined): RequestHandler {
  return (req, _res, next) => {
    const expected = Buffer.from(`Bearer ${secret ?? ''}`);
    const given = Buffer.from(req.headers.authorization ?? '');
    const valid = !!secret && given.length === expected.length && timingSafeEqual(given, expected);
    if (!valid) throw new HttpError(401, 'Unauthorized');
    next();
  };
}

/** Scheduled jobs (apps/api/vercel.json). */
export function cronRouter(deps: AppDeps): Router {
  const router = Router();
  router.use(requireCronSecret(deps.cronSecret));

  // Daily: delete visitor-hash salts older than 2 days (§7.7).
  router.get('/cleanup-salts', async (_req, res) => {
    const deleted = await cleanupSalts(deps.repo);
    logger.info('cron cleanup-salts', { deleted });
    res.json({ ok: true, deleted });
  });

  // Daily: pull yesterday's numbers for every connected social account (§13).
  router.get('/social-sync', async (_req, res) => {
    const result = await syncAllAccounts(deps);
    logger.info('cron social-sync', { ...result });
    res.json({ ok: true, ...result });
  });

  // Weekly: delete raw visits and page views past each workspace's retention (§5, Phase 6).
  router.get('/retention', async (_req, res) => {
    const result = await deps.repo.purgeExpiredData();
    logger.info('cron retention', { ...result });
    res.json({ ok: true, ...result });
  });

  return router;
}
