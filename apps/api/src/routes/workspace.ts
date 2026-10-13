import { updateWorkspaceBodySchema } from '@audience/shared';
import { Router } from 'express';
import type { AppDeps } from '../createApp.js';
import type { TablesUpdate } from '../db/database.types.js';
import { toWorkspaceDto } from '../db/mappers.js';
import { getAuth, requireAuth } from '../middleware/requireAuth.js';
import { HttpError } from '../utils/httpError.js';

/** The signed-in user's workspace (§10). */
export function workspaceRouter({ repo }: AppDeps): Router {
  const router = Router();
  router.use(requireAuth(repo));

  router.get('/', async (_req, res) => {
    const { workspaceId, role } = getAuth(res);
    const workspace = await repo.findWorkspaceById(workspaceId);
    if (!workspace) throw new HttpError(404, 'Workspace not found.');
    res.json(toWorkspaceDto(workspace, role));
  });

  router.patch('/', async (req, res) => {
    const { workspaceId, role } = getAuth(res);
    const body = updateWorkspaceBodySchema.parse(req.body);
    const patch: TablesUpdate<'workspaces'> = {};
    if (body.name !== undefined) patch.name = body.name;
    if (body.timezone !== undefined) patch.timezone = body.timezone;
    const before = await repo.findWorkspaceById(workspaceId);
    const workspace = await repo.updateWorkspace(workspaceId, patch);
    if (before && before.timezone !== workspace.timezone) {
      // daily_stats is keyed by local day, so a new timezone moves every visit's day.
      const sites = await repo.listSites(workspaceId);
      if (sites.length) await repo.rebuildDailyStats(sites.map((s) => s.id));
    }
    res.json(toWorkspaceDto(workspace, role));
  });

  return router;
}
