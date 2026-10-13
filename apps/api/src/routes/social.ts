import { Router } from 'express';
import type { AppDeps } from '../createApp.js';
import { notImplemented } from '../utils/httpError.js';

// TODO(Phase 4, §13): accounts, connect, callback, disconnect, overview
export function socialRouter(_deps: AppDeps): Router {
  const router = Router();
  router.use(notImplemented(4));
  return router;
}
