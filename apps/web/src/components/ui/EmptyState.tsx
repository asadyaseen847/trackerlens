import type { ReactNode } from 'react';
import styles from './EmptyState.module.css';

export interface EmptyStateProps {
  title: string;
  body: ReactNode;
  /** Usually a <Button />. */
  action?: ReactNode;
}

/** Dashed card for "nothing here yet" (e.g. "Waiting for the first visit", §11). */
export function EmptyState({ title, body, action }: EmptyStateProps) {
  return (
    <div className={styles.waiting}>
      <div>
        <h2>{title}</h2>
        <p>{body}</p>
      </div>
      {action}
    </div>
  );
}
