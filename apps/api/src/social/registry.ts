import { SOCIAL_PLATFORMS, type SocialPlatform } from '@audience/shared';
import type { ProviderConfig, SocialProvider } from './provider.js';
import { linkedinProvider } from './providers/linkedin.js';
import { facebookProvider, instagramProvider } from './providers/meta.js';
import { mockProvider } from './providers/mock.js';
import { tiktokProvider } from './providers/tiktok.js';
import { xProvider } from './providers/x.js';
import { youtubeProvider } from './providers/youtube.js';

export type ProviderOptions = ProviderConfig & { useMock: boolean };

function realProvider(platform: SocialPlatform, config: ProviderConfig): SocialProvider {
  switch (platform) {
    case 'linkedin':
      return linkedinProvider(config);
    case 'instagram':
      return instagramProvider;
    case 'facebook':
      return facebookProvider;
    case 'youtube':
      return youtubeProvider;
    case 'tiktok':
      return tiktokProvider;
    case 'x':
      return xProvider;
  }
}

/** The provider for a platform: the mock one when SOCIAL_MOCK is on (§13). */
export function getProvider(platform: SocialPlatform, options: ProviderOptions): SocialProvider {
  return options.useMock ? mockProvider(platform, options) : realProvider(platform, options);
}

/** Platforms that can be connected right now (all of them with the mock provider). */
export function availablePlatforms(options: ProviderOptions): SocialPlatform[] {
  return SOCIAL_PLATFORMS.map((p) => p.id).filter((p) => getProvider(p, options).available);
}

/** Provider options from the app's settings. */
export function providerOptions(deps: {
  socialMock: boolean;
  appUrl: string;
  linkedin?: ProviderConfig['linkedin'];
}): ProviderOptions {
  return {
    useMock: deps.socialMock,
    appUrl: deps.appUrl,
    ...(deps.linkedin ? { linkedin: deps.linkedin } : {}),
  };
}
