import { Router } from 'express';
import type { AppDeps } from '../createApp.js';
import { getAuth, requireAuth } from '../middleware/requireAuth.js';
import { exportCsv, getBreakdown, getLive, getOverview } from '../services/stats.service.js';

/** Dashboard numbers for the signed-in workspace (§10). Query: site, period, channels, device, country. */
export function statsRouter({ repo }: AppDeps): Router {
  const router = Router();
  router.use(requireAuth(repo));

  router.get('/overview', async (req, res) => {
    res.json(await getOverview(repo, getAuth(res).workspaceId, req.query));
  });

  router.get('/breakdown', async (req, res) => {
    res.json(await getBreakdown(repo, getAuth(res).workspaceId, req.query));
  });

  router.get('/live', async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    res.json(await getLive(repo, getAuth(res).workspaceId, req.query));
  });

  router.get('/export.csv', async (req, res) => {
    const csv = await exportCsv(repo, getAuth(res).workspaceId, req.query);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="trackerlens-visits.csv"');
    res.send(csv);
  });

  return router;
}
