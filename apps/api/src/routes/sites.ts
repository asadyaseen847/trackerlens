import {
  buildSnippet,
  trackerScriptUrl,
  type SitesResponse,
  type SiteStatusResponse,
} from '@audience/shared';
import { Router } from 'express';
import { loadEnv } from '../config/env.js';
import type { AppDeps } from '../createApp.js';
import { toSiteDto, toSiteListItem } from '../db/mappers.js';
import { getAuth, requireAuth } from '../middleware/requireAuth.js';
import { createSite, getSiteInWorkspace, updateSiteSettings } from '../services/sites.service.js';
import { siteCardStats } from '../services/stats.service.js';
import { HttpError } from '../utils/httpError.js';

/** Websites in the signed-in user's workspace (§10). Every :id is checked against it. */
export function sitesRouter({ repo }: AppDeps): Router {
  const router = Router();
  router.use(requireAuth(repo));

  router.get('/', async (_req, res) => {
    const { workspaceId } = getAuth(res);
    const [sites, workspace] = await Promise.all([
      repo.listSites(workspaceId),
      repo.findWorkspaceById(workspaceId),
    ]);
    const stats = await siteCardStats(repo, sites, workspace?.timezone ?? 'UTC');
    const body: SitesResponse = { sites: sites.map((s) => toSiteListItem(s, stats.get(s.id))) };
    res.json(body);
  });

  router.post('/', async (req, res) => {
    const site = await createSite(repo, getAuth(res).workspaceId, req.body);
    res.status(201).json(toSiteDto(site));
  });

  router.get('/:id', async (req, res) => {
    const site = await getSiteInWorkspace(repo, getAuth(res).workspaceId, req.params.id);
    res.json(toSiteDto(site));
  });

  router.patch('/:id', async (req, res) => {
    const site = await getSiteInWorkspace(repo, getAuth(res).workspaceId, req.params.id);
    res.json(toSiteDto(await updateSiteSettings(repo, site, req.body)));
  });

  router.delete('/:id', async (req, res) => {
    const { workspaceId, role } = getAuth(res);
    const site = await getSiteInWorkspace(repo, workspaceId, req.params.id);
    if (role !== 'owner') throw new HttpError(403, 'Only the workspace owner can remove websites.');
    await repo.deleteSite(site.id);
    res.status(204).end();
  });

  router.get('/:id/snippet', async (req, res) => {
    const site = await getSiteInWorkspace(repo, getAuth(res).workspaceId, req.params.id);
    const html = buildSnippet(
      { domain: site.domain, siteKey: site.site_key },
      trackerScriptUrl(loadEnv().APP_URL),
    );
    res.json({ html });
  });

  // "Check installation" (§10, §11): has the code ever sent a visit?
  router.get('/:id/status', async (req, res) => {
    const site = await getSiteInWorkspace(repo, getAuth(res).workspaceId, req.params.id);
    const body: SiteStatusResponse = {
      installed: site.last_event_at !== null,
      lastEventAt: site.last_event_at,
    };
    res.json(body);
  });

  return router;
}
