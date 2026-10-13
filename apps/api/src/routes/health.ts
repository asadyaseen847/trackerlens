import { Router } from 'express';
import { getDb } from '../db/supabase.js';

export const healthRouter = Router();

healthRouter.get('/', (_req, res) => {
  res.json({ ok: true, time: new Date().toISOString() });
});

/** Checks the Supabase connection with one cheap read. Answers 503 when it fails. */
healthRouter.get('/db', async (_req, res) => {
  const started = Date.now();
  try {
    const { error } = await getDb().from('workspaces').select('id', { head: true, count: 'exact' });
    if (error) throw new Error(error.message);
    res.json({ ok: true, db: 'connected', latencyMs: Date.now() - started });
  } catch (err) {
    const detail = process.env.NODE_ENV === 'production' ? undefined : (err as Error).message;
    res.status(503).json({ ok: false, db: 'unreachable', ...(detail ? { detail } : {}) });
  }
});
