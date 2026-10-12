import type { SocialPlatform } from '@audience/shared';
import type { SocialProvider } from './provider.js';
import { facebookProvider, instagramProvider } from './providers/meta.js';
import { mockProviders } from './providers/mock.js';
import { linkedinProvider } from './providers/linkedin.js';
import { tiktokProvider } from './providers/tiktok.js';
import { xProvider } from './providers/x.js';
import { youtubeProvider } from './providers/youtube.js';

const realProviders: Record<SocialPlatform, SocialProvider> = {
  instagram: instagramProvider,
  facebook: facebookProvider,
  youtube: youtubeProvider,
  linkedin: linkedinProvider,
  tiktok: tiktokProvider,
  x: xProvider,
};

/**
 * The provider for a platform: the mock one when SOCIAL_MOCK is on.
 * TODO(Phase 4, §13): read SOCIAL_MOCK from env at the call site.
 */
export function getProvider(platform: SocialPlatform, useMock: boolean): SocialProvider {
  return useMock ? mockProviders[platform] : realProviders[platform];
}
