import { Router } from 'express';
import { notImplemented } from '../utils/httpError.js';

export const workspaceRouter = Router();

// TODO(Phase 1, §10): requireAuth, scoped to the signed-in user's workspace
workspaceRouter.get('/', notImplemented(1));
// TODO(Phase 1, §10): update name and timezone
workspaceRouter.patch('/', notImplemented(1));
