import type { ReactNode } from 'react';
import { formatNumber, formatShare } from '../../lib/format';
import { DeltaChip } from '../ui/DeltaChip';
import styles from './Breakdown.module.css';

export interface BreakdownRowProps {
  name: ReactNode;
  value: number;
  changePct: number | null;
  /** 0–1 share of the total. */
  share: number;
  /** Largest share in the panel: bars are drawn relative to it. */
  maxShare: number;
  /** Bar color, e.g. "var(--t-social)" or "var(--single)". */
  color: string;
  /** Dims rows outside the current filter (countries, devices). */
  dimmed?: boolean;
}

/** Name, value, change chip, share bar and percentage (§11), as in the prototype. */
export function BreakdownRow({
  name,
  value,
  changePct,
  share,
  maxShare,
  color,
  dimmed = false,
}: BreakdownRowProps) {
  const width = maxShare > 0 ? Math.min(100, (share / maxShare) * 100) : 0;
  return (
    <li className={styles.row}>
      <span className={styles.name} style={dimmed ? { opacity: 0.55 } : undefined}>
        {name}
      </span>
      <span className={styles.nums}>
        <span className={styles.value}>{formatNumber(value)}</span>
        <DeltaChip changePct={changePct} size="mini" />
      </span>
      <span className={styles.track}>
        <span className={styles.bar}>
          <i style={{ width: `${width.toFixed(1)}%`, background: color }} />
        </span>
        <span className={styles.pct}>{formatShare(share)}</span>
      </span>
    </li>
  );
}
