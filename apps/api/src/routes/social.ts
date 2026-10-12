import { Router } from 'express';
import { notImplemented } from '../utils/httpError.js';

export const socialRouter = Router();

// TODO(Phase 4, §13): requireAuth, scoped to the workspace
socialRouter.get('/accounts', notImplemented(4));
// TODO(Phase 4, §13): redirect to the provider's OAuth screen with a signed state (mock first)
socialRouter.get('/connect/:platform', notImplemented(4));
// TODO(Phase 4, §13): exchange code, encrypt tokens, upsert SocialAccount
socialRouter.get('/callback/:platform', notImplemented(4));
// TODO(Phase 4, §13)
socialRouter.delete('/accounts/:id', notImplemented(4));
// TODO(Phase 4, §13): totals, per-platform series, "views → visits" table
socialRouter.get('/overview', notImplemented(4));
