import type { ReactNode } from 'react';
import { Panel } from '../ui/Panel';
import { Skeleton } from '../ui/Skeleton';
import styles from './Breakdown.module.css';

export interface BreakdownPanelProps {
  title: string;
  sub: string;
  loading: boolean;
  /** Shown when there are no rows. */
  emptyText: string;
  /** <BreakdownRow /> elements. */
  children: ReactNode[];
}

/** Platforms, Top pages, Campaigns, Countries, Devices (§11). */
export function BreakdownPanel({ title, sub, loading, emptyText, children }: BreakdownPanelProps) {
  return (
    <Panel title={title} sub={sub}>
      {loading ? (
        <div className={styles.loading} aria-busy="true">
          <span className="sr-only">Loading…</span>
          {Array.from({ length: 5 }, (_, i) => (
            <Skeleton key={i} height={34} />
          ))}
        </div>
      ) : children.length === 0 ? (
        <p className={styles.empty}>{emptyText}</p>
      ) : (
        <ul className={styles.rows}>{children}</ul>
      )}
    </Panel>
  );
}
