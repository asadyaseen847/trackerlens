import type { RequestHandler } from 'express';

export interface RateLimitOptions {
  windowMs: number;
  max: number;
}

/**
 * Simple in-memory limiter as a safety net (Vercel Firewall is the main defence).
 * Keys must be hashed, never the raw IP.
 * TODO(Phase 1, §14): auth endpoints. TODO(Phase 2, §7): collect endpoint.
 */
export function rateLimit(_options: RateLimitOptions): RequestHandler {
  return (_req, _res, next) => {
    next();
  };
}
