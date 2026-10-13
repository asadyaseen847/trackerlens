import type { SiteListItem } from '@audience/shared';
import type { ReactNode } from 'react';
import { Sparkline } from '../../components/charts/Sparkline';
import { StatusChip } from '../../components/ui/StatusChip';
import { formatBig } from '../../lib/format';
import styles from './Websites.module.css';

export interface SiteCardsProps {
  sites: ReadonlyArray<SiteListItem>;
  /** 'all' or a site id. */
  selected: string;
  onSelect: (site: string) => void;
  onAdd: () => void;
}

/**
 * "All websites" first, then one card per site (status, visits in the last 30 days and a
 * 14-day sparkline), the selected card inverted, and "Add website" last (§11).
 */
export function SiteCards({ sites, selected, onSelect, onAdd }: SiteCardsProps) {
  const liveCount = sites.filter((s) => s.status === 'live').length;
  const allTotal = sites.reduce((sum, s) => sum + s.visits30d, 0);
  const allSpark = Array.from({ length: 14 }, (_, i) =>
    sites.reduce((sum, s) => sum + (s.sparkline[i] ?? 0), 0),
  );

  const card = (
    id: string,
    host: string,
    status: ReactNode,
    total: number,
    spark: number[],
    hasData: boolean,
  ) => {
    const pressed = selected === id;
    return (
      <button
        key={id}
        type="button"
        className={styles.site}
        aria-pressed={pressed}
        onClick={() => onSelect(id)}
      >
        <span className={styles.top}>
          <span className={styles.host}>{host}</span>
          {status}
        </span>
        {hasData ? (
          <>
            <span className={styles.num}>{formatBig(total)}</span>
            <span className={styles.sub}>visits, last 30 days</span>
            <Sparkline values={spark} color={pressed ? 'var(--accent)' : 'var(--t-direct)'} />
          </>
        ) : (
          <span className={styles.sub}>No visits yet. Add the code to start counting.</span>
        )}
      </button>
    );
  };

  return (
    <div className={styles.sites} role="group" aria-label="Pick a website">
      {card(
        'all',
        'All websites',
        <StatusChip status="live" label={`${liveCount} live`} />,
        allTotal,
        allSpark,
        sites.some((s) => s.firstEventAt),
      )}
      {sites.map((s) =>
        card(
          s.id,
          s.domain,
          <StatusChip status={s.status} />,
          s.visits30d,
          s.sparkline,
          !!s.firstEventAt,
        ),
      )}
      <button type="button" className={`${styles.site} ${styles.add}`} onClick={onAdd}>
        <span className={styles.plus} aria-hidden="true">
          +
        </span>
        Add website
      </button>
    </div>
  );
}
