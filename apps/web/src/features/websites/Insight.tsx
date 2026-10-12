import type { BreakdownRow } from '@audience/shared';

export interface InsightProps {
  platforms: ReadonlyArray<BreakdownRow>;
  siteLabel: string;
}

// TODO(Phase 3, §11): "Instagram sent the most visits to … (31%). TikTok grew the fastest, up 42%."
export function Insight(_props: InsightProps) {
  return null;
}
