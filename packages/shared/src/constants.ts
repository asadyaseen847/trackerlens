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

/** Display names for platform ids (BUILD_PROMPT §8). Unknown referrer hosts display as-is. */
export const PLATFORM_LABELS: Readonly<Record<string, string>> = {
  direct: 'Typed in or bookmarked',
  google: 'Google',
  bing: 'Bing',
  duckduckgo: 'DuckDuckGo',
  yahoo: 'Yahoo',
  yandex: 'Yandex',
  baidu: 'Baidu',
  ecosia: 'Ecosia',
  brave: 'Brave Search',
  facebook: 'Facebook',
  instagram: 'Instagram',
  x: 'X / Twitter',
  linkedin: 'LinkedIn',
  tiktok: 'TikTok',
  youtube: 'YouTube',
  reddit: 'Reddit',
  pinterest: 'Pinterest',
  threads: 'Threads',
  snapchat: 'Snapchat',
  quora: 'Quora',
  telegram: 'Telegram',
  whatsapp: 'WhatsApp',
  chatgpt: 'ChatGPT',
  perplexity: 'Perplexity',
  gemini: 'Gemini',
  copilot: 'Copilot',
  claude: 'Claude',
  gmail: 'Gmail',
  outlook: 'Outlook',
  'yahoo-mail': 'Yahoo Mail',
};

/** A visit ends after 30 minutes without activity (BUILD_PROMPT §9). */
export const SESSION_TIMEOUT_MS = 30 * 60 * 1000;

/** "On the site right now" window (BUILD_PROMPT §9). */
export const LIVE_WINDOW_MS = 5 * 60 * 1000;

/** Default raw data retention in months (BUILD_PROMPT §5). */
export const DEFAULT_RETENTION_MONTHS = 25;
