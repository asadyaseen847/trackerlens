import styles from './DeltaChip.module.css';

export interface DeltaChipProps {
  /** Percent change; null when there is nothing to compare with. */
  changePct: number | null;
  /** Small inline variant for breakdown rows. */
  size?: 'default' | 'mini';
}

/**
 * Change chip: ▲ green, ▼ pink, always with the number, never color alone (§12).
 * TODO(Phase 3, §11): final wording and rounding ("New", "No change").
 */
export function DeltaChip({ changePct, size = 'default' }: DeltaChipProps) {
  const dir = changePct === null || changePct === 0 ? 'plain' : changePct > 0 ? 'up' : 'down';
  const text =
    changePct === null
      ? 'No earlier data'
      : `${dir === 'up' ? '▲' : dir === 'down' ? '▼' : ''} ${Math.abs(changePct)}%`.trim();
  return (
    <span data-delta className={`${size === 'mini' ? styles.mini : styles.delta} ${styles[dir]}`}>
      {text}
    </span>
  );
}
