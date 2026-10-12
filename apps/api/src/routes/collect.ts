import { Router } from 'express';
import { collectCors } from '../middleware/collectCors.js';
import { notImplemented } from '../utils/httpError.js';

/** POST /api/e — the tracker's collect endpoint. Public, cross-origin, no cookies. */
export const collectRouter = Router();

collectRouter.use(collectCors);

// TODO(Phase 2, §7): CORS preflight
collectRouter.options('/', notImplemented(2));
// TODO(Phase 2, §7): text/plain ≤ 2 KB, validate, site lookup, hostname check, bots, hash,
// session, pageview. Always 202, never 5xx to the tracker.
collectRouter.post('/', notImplemented(2));
