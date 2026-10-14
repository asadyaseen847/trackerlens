import { SOCIAL_PLATFORMS, type SocialPlatform } from '@audience/shared';
import type { ProviderConfig, SocialProvider } from './provider.js';
import { facebookProvider, instagramProvider } from './providers/meta.js';
import { mockProvider } from './providers/mock.js';
import { linkedinProvider } from './providers/linkedin.js';
import { tiktokProvider } from './providers/tiktok.js';
import { xProvider } from './providers/x.js';
import { youtubeProvider } from './providers/youtube.js';

const REAL: Record<SocialPlatform, SocialProvider> = {
  instagram: instagramProvider,
  facebook: facebookProvider,
  youtube: youtubeProvider,
  linkedin: linkedinProvider,
  tiktok: tiktokProvider,
  x: xProvider,
};

/** The provider for a platform: the mock one when SOCIAL_MOCK is on (§13). */
export function getProvider(
  platform: SocialPlatform,
  options: ProviderConfig & { useMock: boolean },
): SocialProvider {
  return options.useMock ? mockProvider(platform, options) : REAL[platform];
}

/** Platforms that can be connected right now (all of them with the mock provider). */
export function availablePlatforms(
  options: ProviderConfig & { useMock: boolean },
): SocialPlatform[] {
  return SOCIAL_PLATFORMS.map((p) => p.id).filter((p) => getProvider(p, options).available);
}
