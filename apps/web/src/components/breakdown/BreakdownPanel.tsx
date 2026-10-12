import type { BreakdownRow as Row } from '@audience/shared';
import { Panel } from '../ui/Panel';
import { BreakdownRow } from './BreakdownRow';

export interface BreakdownPanelProps {
  title: string;
  sub: string;
  rows: ReadonlyArray<Row>;
}

/**
 * Platforms, Top pages, Campaigns, Countries, Devices (§11).
 * TODO(Phase 3, §11): loading skeleton, empty text, prototype list styles.
 */
export function BreakdownPanel({ title, sub, rows }: BreakdownPanelProps) {
  return (
    <Panel title={title} sub={sub}>
      <ul>
        {rows.map((row) => (
          <BreakdownRow key={row.key} row={row} />
        ))}
      </ul>
    </Panel>
  );
}
