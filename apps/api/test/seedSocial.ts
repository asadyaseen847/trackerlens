import type { SocialPlatform } from '@audience/shared';
import type { AppDeps } from '../src/createApp.js';
import type { Repo } from '../src/db/repo.js';
import { encryptToken } from '../src/social/crypto.js';
import { syncAccount } from '../src/social/sync.js';

/**
 * Connects mock social accounts to a workspace and backfills their numbers, like clicking
 * Connect with SOCIAL_MOCK=true. TikTok stays unconnected, as in the prototype.
 */
export async function connectMockAccounts(
  repo: Repo,
  workspaceId: string,
  platforms: SocialPlatform[] = ['instagram', 'facebook', 'youtube', 'linkedin', 'x'],
): Promise<void> {
  const deps: AppDeps = {
    repo,
    authRateLimit: { windowMs: 60_000, max: 10 },
    collectRateLimit: { windowMs: 60_000, max: 300 },
    cronSecret: undefined,
    socialMock: true,
    encryptionKey: undefined,
    appUrl: 'http://localhost:5173',
  };
  for (const platform of platforms) {
    const account = await repo.upsertSocialAccount({
      workspace_id: workspaceId,
      platform_id: platform,
      external_id: `mock-${platform}`,
      handle: 'mybrand',
      name: 'My Brand (sample)',
      status: 'connected',
    });
    await repo.saveSocialTokens({
      social_account_id: account.id,
      access_token_enc: encryptToken(`mock-${platform}-access`, undefined),
      scopes: ['mock'],
    });
    await syncAccount(deps, account);
  }
}
