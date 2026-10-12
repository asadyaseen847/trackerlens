import type { ReactNode } from 'react';
import styles from './Tile.module.css';

export interface TileProps {
  label: ReactNode;
  value: string;
  /** Usually a <DeltaChip />. */
  delta?: ReactNode;
  /** The one lime tile on the screen (§12). */
  hot?: boolean;
}

/** KPI tile (§11). */
export function Tile({ label, value, delta, hot = false }: TileProps) {
  return (
    <div className={[styles.tile, hot && styles.hot].filter(Boolean).join(' ')}>
      <div className={styles.lab}>{label}</div>
      <div className={styles.num}>{value}</div>
      {delta}
    </div>
  );
}
