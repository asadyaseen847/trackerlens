import express, { Router, type ErrorRequestHandler, type Request } from 'express';
import type { AppDeps } from '../createApp.js';
import { collectCors } from '../middleware/collectCors.js';
import { rateLimit } from '../middleware/rateLimit.js';
import { handleHit } from '../services/collect.service.js';
import { logger } from '../utils/logger.js';

/** The visitor's IP, used only in memory for the daily hash. */
function clientIp(req: Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  const first = (Array.isArray(forwarded) ? forwarded[0] : forwarded)?.split(',')[0]?.trim();
  const real = req.headers['x-real-ip'];
  return first || (Array.isArray(real) ? real[0] : real) || req.ip || '';
}

/**
 * POST /api/e — the tracker's collect endpoint (§7). Public, cross-origin, no cookies.
 * Always answers 202 with an empty body, even for invalid or dropped hits; never a 5xx.
 * Mounted before express.json() so any body is read as text (max 2 KB).
 */
export function collectRouter({ repo, collectRateLimit }: AppDeps): Router {
  const router = Router();
  router.use(collectCors);

  router.post(
    '/',
    rateLimit(collectRateLimit),
    express.text({ type: () => true, limit: '2kb' }),
    async (req, res) => {
      try {
        const country = req.headers['x-vercel-ip-country'];
        await handleHit(repo, req.body, {
          ip: clientIp(req),
          userAgent: req.headers['user-agent'],
          country: Array.isArray(country) ? country[0] : country,
        });
      } catch (err) {
        // Log without request details: the body and headers could identify the visitor.
        logger.error('collect failed', { error: err instanceof Error ? err.message : String(err) });
      }
      res.status(202).end();
    },
  );

  // Too large, unreadable or rate-limited: drop quietly, still 202.
  const swallow: ErrorRequestHandler = (_err, _req, res, _next) => {
    res.status(202).end();
  };
  router.use(swallow);

  return router;
}
