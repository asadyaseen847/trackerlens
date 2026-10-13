import type { RequestHandler, Response } from 'express';
import type { Repo } from '../db/repo.js';
import { SESSION_COOKIE, verifySession } from '../services/auth.service.js';
import { HttpError } from '../utils/httpError.js';

export interface AuthContext {
  userId: string;
  workspaceId: string;
  role: 'owner' | 'member';
}

const SIGNED_OUT = 'Please log in.';

/**
 * Verifies the session cookie and puts the user's workspace on res.locals.auth. Every
 * workspace-scoped query must use getAuth(res).workspaceId.
 */
export function requireAuth(repo: Repo): RequestHandler {
  return async (req, res, next) => {
    const token: unknown = req.cookies?.[SESSION_COOKIE];
    const userId = typeof token === 'string' ? verifySession(token) : null;
    if (!userId) throw new HttpError(401, SIGNED_OUT);

    const membership = await repo.findMembershipForUser(userId);
    if (!membership) throw new HttpError(401, SIGNED_OUT);

    const auth: AuthContext = {
      userId,
      workspaceId: membership.workspace_id,
      role: membership.role,
    };
    res.locals['auth'] = auth;
    next();
  };
}

/** The AuthContext set by requireAuth. Throws if the route forgot to use it. */
export function getAuth(res: Response): AuthContext {
  const auth = res.locals['auth'] as AuthContext | undefined;
  if (!auth) throw new Error('getAuth() called on a route without requireAuth');
  return auth;
}
