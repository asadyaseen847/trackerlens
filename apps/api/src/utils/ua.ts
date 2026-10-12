import type { Device } from '@audience/shared';

export interface ParsedUserAgent {
  browser?: string;
  os?: string;
}

/**
 * Browser and OS names from the user agent (bowser). The full UA is never stored.
 * TODO(Phase 2, §7.8): implement.
 */
export function parseUserAgent(_userAgent: string): ParsedUserAgent {
  return {};
}

/**
 * Under 768 is phone, under 1024 is tablet, otherwise desktop.
 * TODO(Phase 2, §7.8): implement.
 */
export function deviceFromWidth(_width: number): Device {
  return 'desktop';
}

/**
 * True when the user agent is missing or isbot flags it.
 * TODO(Phase 2, §7.5): implement.
 */
export function isBotUserAgent(_userAgent: string | undefined): boolean {
  return false;
}
