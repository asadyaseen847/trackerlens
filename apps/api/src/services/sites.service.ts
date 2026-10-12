// TODO(Phase 1, §10): list / create / update / delete sites, scoped to the workspace

/**
 * Public site key: a prefix + 6 characters from an unambiguous alphabet, e.g. "ws_7Q2K9X".
 * TODO(Phase 1, §10): implement with crypto.randomInt and retry on collision.
 */
export function generateSiteKey(): string {
  return 'ws_XXXXXX';
}
