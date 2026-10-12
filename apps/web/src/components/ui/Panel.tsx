import { useId, type ReactNode } from 'react';
import styles from './Panel.module.css';

export interface PanelProps {
  title: string;
  sub?: string;
  /** Right side of the header (toggles, buttons). */
  actions?: ReactNode;
  children: ReactNode;
}

/** Bordered section card with a header (§11). */
export function Panel({ title, sub, actions, children }: PanelProps) {
  const titleId = useId();
  return (
    <section className={styles.panel} aria-labelledby={titleId}>
      <div className={styles.head}>
        <div>
          <h2 id={titleId}>{title}</h2>
          {sub && <p className={styles.sub}>{sub}</p>}
        </div>
        {actions}
      </div>
      {children}
    </section>
  );
}
