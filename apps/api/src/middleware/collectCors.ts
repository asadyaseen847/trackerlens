import type { RequestHandler } from 'express';

/**
 * Open CORS for the collect endpoint only: any origin, POST + OPTIONS, no credentials.
 * TODO(Phase 2, §7.1): implement.
 */
export const collectCors: RequestHandler = (_req, _res, next) => {
  next();
};
