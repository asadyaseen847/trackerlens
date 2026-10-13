import type { BreakdownRow } from '@audience/shared';

export interface InsightProps {
  platforms: ReadonlyArray<BreakdownRow> | undefined;
  /** "shop.example.com" or "your websites". */
  where: string;
}

/**
 * "**Instagram** sent the most visits to shop.example.com (31%). **TikTok** grew the fastest,
 * up 42%." Built from the platform breakdown (§11). The fastest grower must have at least 3%
 * of visits, so tiny sources don't win with "up 900%".
 */
export function Insight({ platforms, where }: InsightProps) {
  const top = platforms?.[0];
  if (!top) return null;
  const fastest = platforms
    .filter((p) => p.key !== top.key && p.share >= 0.03 && p.changePct !== null && p.changePct > 0)
    .sort((a, b) => (b.changePct ?? 0) - (a.changePct ?? 0))[0];
  return (
    <>
      <b>{top.label}</b> sent the most visits to {where} ({Math.round(top.share * 100)}%).
      {fastest && (
        <>
          {' '}
          <b>{fastest.label}</b> grew the fastest, up {Math.round(fastest.changePct ?? 0)}%.
        </>
      )}
    </>
  );
}
