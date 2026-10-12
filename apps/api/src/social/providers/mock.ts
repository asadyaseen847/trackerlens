import type { SocialPlatform } from '@audience/shared';
import { notImplementedProvider, type SocialProvider } from '../provider.js';

// TODO(Phase 4, §13): deterministic sample data, enabled with SOCIAL_MOCK=true,
// labeled "Sample data" in the UI.
export const mockProviders: Record<SocialPlatform, SocialProvider> = {
  instagram: notImplementedProvider('instagram', 4),
  facebook: notImplementedProvider('facebook', 4),
  youtube: notImplementedProvider('youtube', 4),
  linkedin: notImplementedProvider('linkedin', 4),
  tiktok: notImplementedProvider('tiktok', 4),
  x: notImplementedProvider('x', 4),
};
