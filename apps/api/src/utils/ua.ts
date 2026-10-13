import type { Device } from '@audience/shared';
import Bowser from 'bowser';
import { isbot } from 'isbot';

export interface ParsedUserAgent {
  browser: string | null;
  os: string | null;
}

/** Browser and OS names only (bowser, MIT). The full user agent is never stored (§14). */
export function parseUserAgent(userAgent: string): ParsedUserAgent {
  try {
    const parser = Bowser.getParser(userAgent);
    return {
      browser: parser.getBrowserName() || null,
      os: parser.getOSName() || null,
    };
  } catch {
    return { browser: null, os: null };
  }
}

/** Under 768 px is a phone, under 1024 px a tablet, otherwise desktop (§7.8). */
export function deviceFromWidth(width: number): Device {
  if (width < 768) return 'phone';
  if (width < 1024) return 'tablet';
  return 'desktop';
}

/** True when the user agent is missing or isbot flags it (§7.5). */
export function isBotUserAgent(userAgent: string | undefined): boolean {
  return !userAgent || isbot(userAgent);
}
