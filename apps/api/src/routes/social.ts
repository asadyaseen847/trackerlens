import type { SocialAccountsResponse } from '@audience/shared';
import { Router } from 'express';
import type { AppDeps } from '../createApp.js';
import { getAuth, requireAuth } from '../middleware/requireAuth.js';
import {
  completeConnection,
  connectUrl,
  getSocialOverview,
  parsePlatform,
  toSocialAccountDto,
} from '../services/social.service.js';
import { HttpError } from '../utils/httpError.js';
import { logger } from '../utils/logger.js';

/** Connected social accounts for the signed-in workspace (§10, §13). */
export function socialRouter(deps: AppDeps): Router {
  const { repo } = deps;
  const router = Router();
  router.use(requireAuth(repo));

  router.get('/accounts', async (_req, res) => {
    const accounts = await repo.listSocialAccounts(getAuth(res).workspaceId);
    const body: SocialAccountsResponse = {
      accounts: accounts.map(toSocialAccountDto),
      sampleData: deps.socialMock,
    };
    res.json(body);
  });

  // The browser navigates here; we send it on to the platform's consent screen.
  router.get('/connect/:platform', (req, res) => {
    const platform = parsePlatform(req.params.platform);
    res.redirect(302, connectUrl(deps, getAuth(res), platform));
  });

  // The platform sends the browser back here with ?code=&state=.
  router.get('/callback/:platform', async (req, res) => {
    const platform = parsePlatform(req.params.platform);
    const back = new URL('/app/social', deps.appUrl);
    const code = typeof req.query['code'] === 'string' ? req.query['code'] : '';
    const state = typeof req.query['state'] === 'string' ? req.query['state'] : '';
    try {
      if (!code || !state) throw new HttpError(400, 'The platform did not finish connecting.');
      await completeConnection(deps, getAuth(res), platform, code, state);
      back.searchParams.set('connected', platform);
    } catch (err) {
      logger.warn('social connect failed', {
        platform,
        error: err instanceof Error ? err.message : String(err),
      });
      back.searchParams.set('error', platform);
    }
    res.redirect(302, back.pathname + back.search);
  });

  router.delete('/accounts/:id', async (req, res) => {
    const account = await repo.findSocialAccountById(req.params.id);
    if (!account || account.workspace_id !== getAuth(res).workspaceId) {
      throw new HttpError(404, 'Account not found.');
    }
    await repo.deleteSocialAccount(account.id);
    res.status(204).end();
  });

  router.get('/overview', async (req, res) => {
    res.json(await getSocialOverview(deps, getAuth(res).workspaceId, req.query));
  });

  return router;
}
