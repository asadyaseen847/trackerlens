// TODO(Phase 3, §11): real formatters (Intl, compact numbers, workspace timezone).

export function formatNumber(value: number): string {
  return String(value);
}

export function formatPercent(value: number): string {
  return `${value}%`;
}

export function formatDate(iso: string): string {
  return iso;
}

/** "2 minutes ago". TODO(Phase 2, §11): used by "Check installation". */
export function formatRelative(iso: string): string {
  return iso;
}
