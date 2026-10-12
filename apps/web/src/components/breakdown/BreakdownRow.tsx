import type { BreakdownRow as Row } from '@audience/shared';

export interface BreakdownRowProps {
  row: Row;
}

/**
 * Name, value, change chip, share bar and percentage (§11).
 * TODO(Phase 3, §11): full row layout from the prototype.
 */
export function BreakdownRow({ row }: BreakdownRowProps) {
  return (
    <li>
      {row.label}: {row.value}
    </li>
  );
}
