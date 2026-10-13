import { Router } from 'express';
import type { AppDeps } from '../createApp.js';
import { getAuth, requireAuth } from '../middleware/requireAuth.js';
import { rateLimit } from '../middleware/rateLimit.js';
import {
  loadMe,
  login,
  SESSION_COOKIE,
  sessionCookieOptions,
  signSession,
  signup,
} from '../services/auth.service.js';
import { HttpError } from '../utils/httpError.js';

/** Email + password auth with a JWT in an httpOnly cookie (§10, §14). */
export function authRouter({ repo, authRateLimit }: AppDeps): Router {
  const router = Router();
  const limit = rateLimit(authRateLimit);

  router.post('/signup', limit, async (req, res) => {
    const me = await signup(repo, req.body);
    res.cookie(SESSION_COOKIE, signSession(me.user.id), sessionCookieOptions());
    res.status(201).json(me);
  });

  router.post('/login', limit, async (req, res) => {
    const me = await login(repo, req.body);
    res.cookie(SESSION_COOKIE, signSession(me.user.id), sessionCookieOptions());
    res.json(me);
  });

  router.post('/logout', (_req, res) => {
    const { maxAge: _maxAge, ...options } = sessionCookieOptions();
    res.clearCookie(SESSION_COOKIE, options);
    res.status(204).end();
  });

  router.get('/me', requireAuth(repo), async (_req, res) => {
    const me = await loadMe(repo, getAuth(res).userId);
    if (!me) throw new HttpError(401, 'Please log in.');
    res.json(me);
  });

  return router;
}
