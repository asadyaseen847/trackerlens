const nf = new Intl.NumberFormat('en-US');

/** 12,345 */
export function formatNumber(value: number): string {
  return nf.format(Math.round(value));
}

/** Big numbers for tiles and cards: 1.23M, 456.7K, else 12,345 (as in the prototype). */
export function formatBig(value: number): string {
  if (value >= 1e6) return `${(value / 1e6).toFixed(2)}M`;
  if (value >= 1e5) return `${(value / 1e3).toFixed(1)}K`;
  return formatNumber(value);
}

/** Axis labels: 1.5M, 12K, 800. */
export function formatAxis(value: number): string {
  if (value >= 1e6) return `${+(value / 1e6).toFixed(1)}M`;
  if (value >= 1e3) return `${+(value / 1e3).toFixed(1)}K`;
  return String(Math.round(value));
}

/** Share as a percentage with one decimal: 31.4% */
export function formatShare(share: number): string {
  return `${(share * 100).toFixed(1)}%`;
}

/** "just now", "2 minutes ago", "3 hours ago", "5 days ago". */
export function formatRelative(iso: string, now: Date = new Date()): string {
  const seconds = Math.max(0, Math.round((now.getTime() - new Date(iso).getTime()) / 1000));
  if (seconds < 45) return 'just now';
  const units: Array<[number, string]> = [
    [60, 'minute'],
    [60 * 60, 'hour'],
    [24 * 60 * 60, 'day'],
  ];
  let unit: [number, string] = units[0]!;
  for (const u of units) if (seconds >= u[0]) unit = u;
  const count = Math.max(1, Math.round(seconds / unit[0]));
  return `${count} ${unit[1]}${count === 1 ? '' : 's'} ago`;
}

let countryNames: Intl.DisplayNames | null | undefined;

/** "PK" → "Pakistan"; unknown codes (and XX) get a readable fallback. */
export function countryName(code: string): string {
  if (code === 'XX') return 'Unknown';
  if (countryNames === undefined) {
    try {
      countryNames = new Intl.DisplayNames(['en'], { type: 'region' });
    } catch {
      countryNames = null;
    }
  }
  try {
    return countryNames?.of(code) ?? code;
  } catch {
    return code;
  }
}

const DEVICE_LABELS: Record<string, string> = {
  phone: 'Phone',
  tablet: 'Tablet',
  desktop: 'Desktop',
};

export function deviceLabel(device: string): string {
  return DEVICE_LABELS[device] ?? device;
}
