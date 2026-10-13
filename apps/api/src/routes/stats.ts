import { Router } from 'express';
import type { AppDeps } from '../createApp.js';
import { notImplemented } from '../utils/httpError.js';

// TODO(Phase 3, §10): overview, breakdown, live, export.csv
export function statsRouter(_deps: AppDeps): Router {
  const router = Router();
  router.use(notImplemented(3));
  return router;
}
