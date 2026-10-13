import { createHash } from 'node:crypto';
import type { RequestHandler } from 'express';
import { HttpError } from '../utils/httpError.js';

export interface RateLimitOptions {
  windowMs: number;
  max: number;
}

/**
 * Fixed-window, per-client limiter kept in memory as a safety net. Vercel Firewall is the real
 * defence, and on Vercel each function instance has its own counters (§7, §14). Clients are
 * keyed by a hash of the IP, so no IP address is ever stored.
 */
export function rateLimit({ windowMs, max }: RateLimitOptions): RequestHandler {
  const hits = new Map<string, { count: number; resetAt: number }>();

  return (req, res, next) => {
    const now = Date.now();
    if (hits.size > 10_000) {
      for (const [key, entry] of hits) if (entry.resetAt <= now) hits.delete(key);
    }

    const key = createHash('sha256')
      .update(req.ip ?? 'unknown')
      .digest('hex')
      .slice(0, 16);
    const entry = hits.get(key);
    if (!entry || entry.resetAt <= now) {
      hits.set(key, { count: 1, resetAt: now + windowMs });
      next();
      return;
    }

    entry.count += 1;
    if (entry.count > max) {
      res.setHeader('Retry-After', String(Math.ceil((entry.resetAt - now) / 1000)));
      throw new HttpError(429, 'Too many attempts. Wait a minute and try again.');
    }
    next();
  };
}
