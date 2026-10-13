import type { OverviewResponse, StatsFilters } from '@audience/shared';
import { useState, type ReactNode } from 'react';
import { DeltaChip } from '../../components/ui/DeltaChip';
import { Skeleton } from '../../components/ui/Skeleton';
import { Tile } from '../../components/ui/Tile';
import { formatBig, formatNumber } from '../../lib/format';
import { LiveCounter } from './LiveCounter';
import styles from './Websites.module.css';

export interface KpiRowProps {
  kpis: OverviewResponse['kpis'] | undefined;
  filters: StatsFilters;
}

/** Visits (the one lime tile), Unique visitors, Pages viewed, On the site right now (§11). */
export function KpiRow({ kpis, filters }: KpiRowProps) {
  const tile = (
    label: ReactNode,
    kpi: OverviewResponse['kpis']['visits'] | undefined,
    hot = false,
  ) =>
    kpi ? (
      <Tile
        label={label}
        value={formatBig(kpi.value)}
        title={formatNumber(kpi.value)}
        delta={<DeltaChip changePct={kpi.changePct} />}
        hot={hot}
      />
    ) : (
      <Skeleton height={140} radius={20} />
    );

  return (
    <section className={styles.kpis} aria-label="How much traffic">
      {tile('Visits', kpis?.visits, true)}
      {tile(
        <>
          Unique visitors <VisitorsInfo />
        </>,
        kpis?.visitors,
      )}
      {tile('Pages viewed', kpis?.pageviews)}
      <LiveCounter filters={filters} />
    </section>
  );
}

/** Small "i" that explains why unique visitors reset every day (§9). */
function VisitorsInfo() {
  const [open, setOpen] = useState(false);
  return (
    <button
      type="button"
      className={styles.info}
      aria-label="How unique visitors are counted"
      aria-expanded={open}
      onClick={() => setOpen((o) => !o)}
      onBlur={() => setOpen(false)}
    >
      i
      {open && (
        <span role="tooltip" className={styles.infoText}>
          We don’t use cookies, so the same person is counted once per day. Someone who visits on 3
          different days counts as 3 visitors.
        </span>
      )}
    </button>
  );
}
