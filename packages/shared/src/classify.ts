import type { Channel, Utm } from './types.js';

export interface ClassifyInput {
  /** Full page URL, including the query string. */
  pageUrl: string;
  /** document.referrer, or null. */
  referrer: string | null;
  /** The site's normalized domain, e.g. "shop.example.com". */
  siteDomain: string;
}

export interface ClassifyResult {
  channel: Channel;
  /** e.g. 'instagram', 'google', or a referrer host for unknown sites. */
  platform: string;
  isPaid: boolean;
  referrerHost?: string;
  utm: Utm;
}

/**
 * Work out where a visit came from.
 * TODO(Phase 2, §8): implement the UTM → referrer → direct rules and the host table.
 */
export function classify(_input: ClassifyInput): ClassifyResult {
  return { channel: 'direct', platform: 'direct', isPaid: false, utm: {} };
}
