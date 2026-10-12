import { Router } from 'express';
import { notImplemented } from '../utils/httpError.js';

export const authRouter = Router();

// TODO(Phase 1, §10): signup (creates user + workspace + timezone), bcrypt cost 12, JWT httpOnly cookie
authRouter.post('/signup', notImplemented(1));
// TODO(Phase 1, §10): login (rate-limited, §14)
authRouter.post('/login', notImplemented(1));
// TODO(Phase 1, §10): logout (clear cookie)
authRouter.post('/logout', notImplemented(1));
// TODO(Phase 1, §10): current user + workspace
authRouter.get('/me', notImplemented(1));
