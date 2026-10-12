import { Router } from 'express';
import { notImplemented } from '../utils/httpError.js';

/** Vercel Cron Jobs (apps/api/vercel.json). Each must check Authorization: Bearer CRON_SECRET. */
export const cronRouter = Router();

// TODO(Phase 2, §7.7): delete salts older than 2 days (daily)
cronRouter.get('/cleanup-salts', notImplemented(2));
// TODO(Phase 4, §13): sync each connected account up to yesterday (daily)
cronRouter.get('/social-sync', notImplemented(4));
// TODO(Phase 6, §5): delete raw data older than the workspace retention (weekly)
cronRouter.get('/retention', notImplemented(6));
