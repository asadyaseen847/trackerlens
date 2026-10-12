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
  getAuthUrl(state: string): string;
  exchangeCode(code: string): Promise<TokenSet>;
  refresh?(tokens: TokenSet): Promise<TokenSet>;
  fetchProfile(tokens: TokenSet): Promise<SocialProfile>;
  fetchDailyStats(tokens: TokenSet, fromDay: string, toDay: string): Promise<DailyStat[]>;
}

/** Placeholder provider whose every method throws 501 until its phase is built. */
export function notImplementedProvider(id: SocialPlatform, phase: number): SocialProvider {
  const fail = (): never => {
    throw new NotImplementedError(phase);
  };
  return {
    id,
    getAuthUrl: fail,
    exchangeCode: async () => fail(),
    fetchProfile: async () => fail(),
    fetchDailyStats: async () => fail(),
  };
}
