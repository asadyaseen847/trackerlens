import type { Channel, SocialPlatform } from './types.js';

interface ColorEntry<Id extends string> {
  id: Id;
  label: string;
  color: string;
  colorDark: string;
  /** Matching token in apps/web/src/styles/tokens.css. */
  cssVar: string;
}

/**
 * Channel order and colors from BUILD_PROMPT §12. Tested for color-blind safety:
 * don't change the values or the order.
 */
export const CHANNELS: ReadonlyArray<ColorEntry<Channel>> = [
  {
    id: 'social',
    label: 'Social media',
    color: '#FF3D8B',
    colorDark: '#F0458C',
    cssVar: '--t-social',
  },
  { id: 'search', label: 'Search', color: '#2F6BFF', colorDark: '#5B8BFF', cssVar: '--t-search' },
  { id: 'email', label: 'Email', color: '#E86A00', colorDark: '#E0731C', cssVar: '--t-email' },
  { id: 'ai', label: 'AI assistants', color: '#6C3CF5', colorDark: '#9A75FF', cssVar: '--t-ai' },
  { id: 'direct', label: 'Direct', color: '#0E9F92', colorDark: '#14A596', cssVar: '--t-direct' },
  {
    id: 'other',
    label: 'Other websites',
    color: '#BDB7CC',
    colorDark: '#5E5872',
    cssVar: '--t-other',
  },
];

/** Social platform order and colors for the social chart (BUILD_PROMPT §12). */
export const SOCIAL_PLATFORMS: ReadonlyArray<ColorEntry<SocialPlatform>> = [
  { id: 'instagram', label: 'Instagram', color: '#FF3D8B', colorDark: '#F0458C', cssVar: '--p1' },
  { id: 'facebook', label: 'Facebook', color: '#2F6BFF', colorDark: '#5B8BFF', cssVar: '--p2' },
  { id: 'youtube', label: 'YouTube', color: '#E86A00', colorDark: '#E0731C', cssVar: '--p3' },
  { id: 'linkedin', label: 'LinkedIn', color: '#6C3CF5', colorDark: '#9A75FF', cssVar: '--p4' },
  { id: 'tiktok', label: 'TikTok', color: '#0E9F92', colorDark: '#14A596', cssVar: '--p5' },
  { id: 'x', label: 'X / Twitter', color: '#A38200', colorDark: '#A88A0C', cssVar: '--p6' },
];

/**
 * Known platforms and their channel. Must match the `platforms` seed in
 * supabase/migrations/20261013000000_initial_schema.sql (a test checks this).
 * "other" stands for any unknown website or campaign source (detail stored on the visit).
 */
export const PLATFORMS: ReadonlyArray<{ id: string; label: string; channel: Channel }> = [
  { id: 'google', label: 'Google', channel: 'search' },
  { id: 'bing', label: 'Bing', channel: 'search' },
  { id: 'duckduckgo', label: 'DuckDuckGo', channel: 'search' },
  { id: 'yahoo', label: 'Yahoo', channel: 'search' },
  { id: 'yandex', label: 'Yandex', channel: 'search' },
  { id: 'baidu', label: 'Baidu', channel: 'search' },
  { id: 'ecosia', label: 'Ecosia', channel: 'search' },
  { id: 'brave', label: 'Brave Search', channel: 'search' },
  { id: 'instagram', label: 'Instagram', channel: 'social' },
  { id: 'facebook', label: 'Facebook', channel: 'social' },
  { id: 'youtube', label: 'YouTube', channel: 'social' },
  { id: 'linkedin', label: 'LinkedIn', channel: 'social' },
  { id: 'tiktok', label: 'TikTok', channel: 'social' },
  { id: 'x', label: 'X / Twitter', channel: 'social' },
  { id: 'reddit', label: 'Reddit', channel: 'social' },
  { id: 'pinterest', label: 'Pinterest', channel: 'social' },
  { id: 'threads', label: 'Threads', channel: 'social' },
  { id: 'snapchat', label: 'Snapchat', channel: 'social' },
  { id: 'quora', label: 'Quora', channel: 'social' },
  { id: 'telegram', label: 'Telegram', channel: 'social' },
  { id: 'whatsapp', label: 'WhatsApp', channel: 'social' },
  { id: 'chatgpt', label: 'ChatGPT', channel: 'ai' },
  { id: 'perplexity', label: 'Perplexity', channel: 'ai' },
  { id: 'gemini', label: 'Gemini', channel: 'ai' },
  { id: 'copilot', label: 'Copilot', channel: 'ai' },
  { id: 'claude', label: 'Claude', channel: 'ai' },
  { id: 'gmail', label: 'Gmail', channel: 'email' },
  { id: 'outlook', label: 'Outlook', channel: 'email' },
  { id: 'yahoo-mail', label: 'Yahoo Mail', channel: 'email' },
  { id: 'direct', label: 'Typed in or bookmarked', channel: 'direct' },
  { id: 'other', label: 'Other', channel: 'other' },
];

/** Display names for platform ids (BUILD_PROMPT §8). Unknown hosts display as-is. */
export const PLATFORM_LABELS: Readonly<Record<string, string>> = Object.fromEntries(
  PLATFORMS.map((p) => [p.id, p.label]),
);

/** Display name for a platform id or an unknown referrer host. */
export function platformLabel(id: string): string {
  return PLATFORM_LABELS[id] ?? id;
}

/** Product name shown in the UI and the snippet comment. */
export const BRAND_NAME = 'TrackerLens';

/** Query parameter for "ignore my visits" (`?trackerlens_ignore=1`); also the localStorage key. */
export const IGNORE_PARAM = 'trackerlens_ignore';

/** Path of the tracker script on the web app's domain (neutral name for ad blockers, §4). */
export const TRACKER_PATH = '/js/script.js';

/** Public site keys: "ws_" + 6 characters from an alphabet without 0/O/1/I (§10). */
export const SITE_KEY_PREFIX = 'ws_';
export const SITE_KEY_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const SITE_KEY_LENGTH = 6;
export const SITE_KEY_RE = /^ws_[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$/;

/** A visit ends after 30 minutes without activity (BUILD_PROMPT §9). */
export const SESSION_TIMEOUT_MS = 30 * 60 * 1000;

/** "On the site right now" window (BUILD_PROMPT §9). */
export const LIVE_WINDOW_MS = 5 * 60 * 1000;

/** Default raw data retention in months (BUILD_PROMPT §5). */
export const DEFAULT_RETENTION_MONTHS = 25;
