import type { SocialPlatform } from '@audience/shared';
import { callbackUrl, type ProviderConfig, type SocialProvider } from '../provider.js';

/**
 * Deterministic sample data for every platform (§13), enabled with SOCIAL_MOCK=true and labeled
 * "Sample data" in the UI. Numbers follow the prototype: followers grow smoothly, views have a
 * weekly rhythm and occasional viral days. The same day always gives the same numbers.
 */
const PROFILES: Record<
  SocialPlatform,
  { f0: number; fg: number; v0: number; vg: number; er: number; seed: number }
> = {
  instagram: { f0: 4200, fg: 0.55, v0: 2600, vg: 0.6, er: 3.4, seed: 1 },
  facebook: { f0: 6100, fg: 0.16, v0: 1900, vg: 0.18, er: 1.2, seed: 2 },
  youtube: { f0: 900, fg: 0.62, v0: 700, vg: 0.66, er: 4.1, seed: 3 },
  linkedin: { f0: 1500, fg: 0.48, v0: 900, vg: 0.5, er: 2.6, seed: 4 },
  tiktok: { f0: 2200, fg: 0.8, v0: 3100, vg: 0.85, er: 5.9, seed: 5 },
  x: { f0: 3800, fg: 0.22, v0: 2400, vg: 0.25, er: 0.9, seed: 6 },
};

const EPOCH = Date.UTC(2023, 0, 1);
const WEEK = [1.15, 0.95, 0.97, 0.98, 0.99, 1.02, 1.12]; // Sunday first

/** Hash-based noise in [0, 1) for (day, seed): deterministic, no state. */
function noise(a: number, b: number): number {
  let t = (Math.imul(a, 374761393) + Math.imul(b, 668265263)) | 0;
  t = Math.imul(t ^ (t >>> 13), 1274126177);
  t ^= t >>> 16;
  return ((t >>> 0) % 100000) / 100000;
}

export function mockDay(platform: SocialPlatform, day: string) {
  const p = PROFILES[platform];
  const ms = Date.parse(`${day}T00:00:00Z`);
  const i = Math.round((ms - EPOCH) / 86_400_000);
  const years = i / 365.25;
  let views =
    p.v0 *
    Math.exp(p.vg * years) *
    WEEK[new Date(ms).getUTCDay()]! *
    (0.8 + 0.4 * noise(i, 300 + p.seed));
  if (noise(i, 400 + p.seed) < 0.01) views *= 3 + 4 * noise(i, 500 + p.seed);
  const followers = p.f0 * Math.exp(p.fg * years) * (1 + 0.004 * Math.sin(i / 5));
  const engagementRate = (p.er * (1 + 0.15 * Math.sin(i / 9 + p.seed))) / 100;
  return {
    followers: Math.round(followers),
    views: Math.round(views),
    engagements: Math.round(views * engagementRate),
    linkClicks: Math.round(views * 0.004 * (0.8 + 0.4 * noise(i, 600 + p.seed))),
  };
}

function* daysBetween(fromDay: string, toDay: string) {
  for (
    let ms = Date.parse(`${fromDay}T00:00:00Z`);
    ms <= Date.parse(`${toDay}T00:00:00Z`);
    ms += 86_400_000
  ) {
    yield new Date(ms).toISOString().slice(0, 10);
  }
}

export function mockProvider(platform: SocialPlatform, config: ProviderConfig): SocialProvider {
  return {
    id: platform,
    available: true,
    getAuthUrl(state) {
      // No real login screen: go straight to our callback, like a successful OAuth consent.
      // Relative, so it works on any domain before APP_URL is configured.
      const params = new URLSearchParams({ code: `mock-${platform}`, state });
      return `${new URL(callbackUrl(config, platform)).pathname}?${params.toString()}`;
    },
    async exchangeCode(code) {
      return { accessToken: `${code}-access`, refreshToken: `${code}-refresh`, scopes: ['mock'] };
    },
    async fetchProfile() {
      return { externalId: `mock-${platform}`, handle: 'mybrand', name: 'My Brand (sample)' };
    },
    async fetchDailyStats(_tokens, fromDay, toDay) {
      return [...daysBetween(fromDay, toDay)].map((day) => ({ day, ...mockDay(platform, day) }));
    },
  };
}
