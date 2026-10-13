import type { SiteStatus } from '@audience/shared';
import styles from './StatusChip.module.css';

export interface StatusChipProps {
  status: SiteStatus;
  /** Overrides the default text ("Live", "Waiting", "Paused"). */
  label?: string;
}

const LABELS: Record<SiteStatus, string> = {
  live: 'Live',
  waiting: 'Waiting',
  paused: 'Paused',
};

/** Site status chip (§11). */
export function StatusChip({ status, label }: StatusChipProps) {
  return <span className={`${styles.status} ${styles[status]}`}>{label ?? LABELS[status]}</span>;
}
