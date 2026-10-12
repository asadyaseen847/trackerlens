import type { RequestHandler } from 'express';
import { NotImplementedError } from '../utils/httpError.js';

/**
 * Verifies the JWT cookie and loads the user's workspace onto res.locals.
 * TODO(Phase 1, §10): implement. Until then it refuses every request, so nothing
 * is accidentally left unprotected.
 */
export const requireAuth: RequestHandler = (_req, _res, next) => {
  next(new NotImplementedError(1));
};
