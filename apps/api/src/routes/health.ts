import { Router } from 'express';
import type { AppDeps } from '../createApp.js';

export function healthRouter({ repo }: AppDeps): Router {
  const router = Router();

  router.get('/', (_req, res) => {
    res.json({ ok: true, time: new Date().toISOString() });
  });

  /** Checks the database connection with one cheap read. Answers 503 when it fails. */
  router.get('/db', async (_req, res) => {
    const started = Date.now();
    try {
      await repo.ping();
      res.json({ ok: true, db: 'connected', latencyMs: Date.now() - started });
    } catch (err) {
      // Supabase's error text (e.g. "Invalid API key") never contains credentials.
      const reason = err instanceof Error ? err.message : 'Unknown error';
      res.status(503).json({ ok: false, db: 'unreachable', reason });
    }
  });

  return router;
}
