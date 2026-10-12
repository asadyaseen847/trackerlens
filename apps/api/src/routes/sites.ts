import { Router } from 'express';
import { notImplemented } from '../utils/httpError.js';

export const sitesRouter = Router();

// TODO(Phase 1, §10): requireAuth + workspace membership check on every :id route
// TODO(Phase 1, §10): list with status, visits in the last 30 days and a 14-day sparkline
sitesRouter.get('/', notImplemented(1));
// TODO(Phase 1, §10): normalize + validate the domain, reject duplicates, generate siteKey
sitesRouter.post('/', notImplemented(1));
// TODO(Phase 1, §10)
sitesRouter.get('/:id', notImplemented(1));
// TODO(Phase 1, §10): settings
sitesRouter.patch('/:id', notImplemented(1));
// TODO(Phase 1, §10): owner only; also deletes sessions and pageviews
sitesRouter.delete('/:id', notImplemented(1));
// TODO(Phase 1, §10): { html }
sitesRouter.get('/:id/snippet', notImplemented(1));
// TODO(Phase 2, §10): { installed, lastEventAt } for "Check installation"
sitesRouter.get('/:id/status', notImplemented(2));
