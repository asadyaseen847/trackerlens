import type { ReactNode } from 'react';
import styles from './Tile.module.css';

export interface TileProps {
  label: ReactNode;
  value: string;
  /** Exact value shown on hover when `value` is abbreviated (1.2K). */
  title?: string;
  /** Usually a <DeltaChip />. */
  delta?: ReactNode;
  /** The one lime tile on the screen (§12). */
  hot?: boolean;
}

/** KPI tile (§11). */
export function Tile({ label, value, title, delta, hot = false }: TileProps) {
  return (
    <div className={[styles.tile, hot && styles.hot].filter(Boolean).join(' ')}>
      <div className={styles.lab}>{label}</div>
      <div className={styles.num} title={title}>
        {value}
      </div>
      {delta}
    </div>
  );
}
