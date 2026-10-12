import type { CollectPayload } from '@audience/shared';

export interface CollectContext {
  /** In memory only; never stored or logged. */
  ip: string;
  userAgent: string | undefined;
  country: string;
}

/**
 * Handle one tracker hit end to end. Must never throw to the route (it always answers 202).
 * TODO(Phase 2, §7): site cache, hostname check, bots, hash, session, pageview, lastEventAt.
 */
export async function handleHit(_payload: CollectPayload, _ctx: CollectContext): Promise<void> {}
