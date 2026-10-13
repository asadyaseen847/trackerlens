import { buildSnippet, trackerScriptUrl, type SitesResponse } from '@audience/shared';
import { Router } from 'express';
import { loadEnv } from '../config/env.js';
import type { AppDeps } from '../createApp.js';
import { toSiteDto, toSiteListItem } from '../db/mappers.js';
import { getAuth, requireAuth } from '../middleware/requireAuth.js';
import { createSite, getSiteInWorkspace, updateSiteSettings } from '../services/sites.service.js';
import { HttpError, notImplemented } from '../utils/httpError.js';

/** Websites in the signed-in user's workspace (§10). Every :id is checked against it. */
export function sitesRouter({ repo }: AppDeps): Router {
  const router = Router();
  router.use(requireAuth(repo));

  router.get('/', async (_req, res) => {
    const sites = await repo.listSites(getAuth(res).workspaceId);
    const body: SitesResponse = { sites: sites.map(toSiteListItem) };
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

  // TODO(Phase 2, §10): { installed, lastEventAt } for "Check installation"
  router.get('/:id/status', notImplemented(2));

  return router;
}
