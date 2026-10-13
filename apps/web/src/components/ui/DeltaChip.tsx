import styles from './DeltaChip.module.css';

export interface DeltaChipProps {
  /** Percent change; null when there is nothing to compare with. */
  changePct: number | null;
  /** Small inline variant for breakdown rows (whole percents). */
  size?: 'default' | 'mini';
}

/** Change chip: ▲ green, ▼ pink, always with the number, never color alone (§12). */
export function DeltaChip({ changePct, size = 'default' }: DeltaChipProps) {
  const isNew = changePct === null;
  const up = isNew || changePct >= 0;
  const amount = isNew ? '' : Math.abs(changePct).toFixed(size === 'mini' ? 0 : 1);
  const text = isNew ? 'New' : `${up ? '▲' : '▼'} ${amount}%`;
  const label = isNew ? 'New' : `${up ? 'Up' : 'Down'} ${amount} percent`;
  return (
    <span
      data-delta
      className={`${size === 'mini' ? styles.mini : styles.delta} ${up ? styles.up : styles.down}`}
    >
      <span aria-hidden="true">{text}</span>
      <span className="sr-only">{label}</span>
    </span>
  );
}
