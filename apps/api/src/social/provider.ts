import type { SocialPlatform } from '@audience/shared';
import { NotImplementedError } from '../utils/httpError.js';

/** BUILD_PROMPT §13. */
export interface TokenSet {
  accessToken: string;
  refreshToken?: string;
  expiresAt?: Date;
  scopes?: string[];
}

export interface SocialProfile {
  externalId: string;
  handle: string;
  name: string;
  avatarUrl?: string;
}

export interface DailyStat {
  day: string;
  followers?: number;
  views?: number;
  engagements?: number;
  linkClicks?: number;
}

export interface SocialProvider {
  id: SocialPlatform;
  /** False for placeholders: the UI shows "Coming soon" instead of a Connect button. */
  available: boolean;
  getAuthUrl(state: string): string;
  exchangeCode(code: string): Promise<TokenSet>;
  refresh?(tokens: TokenSet): Promise<TokenSet>;
  fetchProfile(tokens: TokenSet): Promise<SocialProfile>;
  fetchDailyStats(tokens: TokenSet, fromDay: string, toDay: string): Promise<DailyStat[]>;
}

/** Settings providers need to build OAuth URLs. */
export interface ProviderConfig {
  /** Public URL of the dashboard; OAuth callbacks go to <appUrl>/api/social/callback/<platform>. */
  appUrl: string;
}

/** The platform refused our token: the account must be reconnected (§13). */
export class ProviderAuthError extends Error {
  constructor(message = 'The platform refused the access token') {
    super(message);
    this.name = 'ProviderAuthError';
  }
}

export function callbackUrl(config: ProviderConfig, platform: SocialPlatform): string {
  return `${config.appUrl.replace(/\/+$/, '')}/api/social/callback/${platform}`;
}

/** Placeholder provider whose every method throws 501 until its phase is built. */
export function notImplementedProvider(id: SocialPlatform, phase: number): SocialProvider {
  const fail = (): never => {
    throw new NotImplementedError(phase);
  };
  return {
    id,
    available: false,
    getAuthUrl: fail,
    exchangeCode: async () => fail(),
    fetchProfile: async () => fail(),
    fetchDailyStats: async () => fail(),
  };
}
