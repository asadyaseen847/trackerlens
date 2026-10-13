import {
  createSiteBodySchema,
  SITE_KEY_ALPHABET,
  SITE_KEY_LENGTH,
  SITE_KEY_PREFIX,
  updateSiteBodySchema,
  type CreateSiteBody,
  type UpdateSiteBody,
} from '@audience/shared';
import { randomInt } from 'node:crypto';
import type { TablesUpdate } from '../db/database.types.js';
import { UniqueViolationError, type Repo, type SiteRow } from '../db/repo.js';
import { HttpError } from '../utils/httpError.js';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const NOT_FOUND = 'Website not found.';

/** Public site key: "ws_" + 6 characters from an unambiguous alphabet, e.g. "ws_7Q2K9X". */
export function generateSiteKey(): string {
  let key = SITE_KEY_PREFIX;
  for (let i = 0; i < SITE_KEY_LENGTH; i++)
    key += SITE_KEY_ALPHABET[randomInt(SITE_KEY_ALPHABET.length)];
  return key;
}

/**
 * Load a site only if it belongs to the workspace. Sites in other workspaces get the same 404
 * as missing ones, so ids can't be probed (§10).
 */
export async function getSiteInWorkspace(
  repo: Repo,
  workspaceId: string,
  siteId: string,
): Promise<SiteRow> {
  if (!UUID_RE.test(siteId)) throw new HttpError(404, NOT_FOUND);
  const site = await repo.findSiteById(siteId);
  if (!site || site.workspace_id !== workspaceId) throw new HttpError(404, NOT_FOUND);
  return site;
}

export async function createSite(
  repo: Repo,
  workspaceId: string,
  input: CreateSiteBody,
): Promise<SiteRow> {
  const { domain } = createSiteBodySchema.parse(input);
  const duplicate = () => new HttpError(409, `${domain} is already in your list.`);
  if (await repo.findSiteByDomain(workspaceId, domain)) throw duplicate();

  // 32^6 ≈ 1 billion keys: collisions are rare, but retry a few times to be safe.
  for (let attempt = 0; attempt < 5; attempt++) {
    const siteKey = generateSiteKey();
    if (await repo.siteKeyExists(siteKey)) continue;
    try {
      return await repo.createSite({ workspace_id: workspaceId, domain, site_key: siteKey });
    } catch (err) {
      if (!(err instanceof UniqueViolationError)) throw err;
      // Either the same domain was added at the same moment, or the key collided.
      if (await repo.findSiteByDomain(workspaceId, domain)) throw duplicate();
    }
  }
  throw new Error('Could not generate a unique site key');
}

export async function updateSiteSettings(
  repo: Repo,
  site: SiteRow,
  input: UpdateSiteBody,
): Promise<SiteRow> {
  const body = updateSiteBodySchema.parse(input);
  const patch: TablesUpdate<'sites'> = {};
  if (body.includeSubdomains !== undefined) patch.include_subdomains = body.includeSubdomains;
  if (body.paused !== undefined) patch.paused = body.paused;
  if (body.allowLocalhost !== undefined) patch.allow_localhost = body.allowLocalhost;
  return repo.updateSite(site.id, patch);
}
