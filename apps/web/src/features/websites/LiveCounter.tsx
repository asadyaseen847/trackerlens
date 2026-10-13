import type { StatsFilters } from '@audience/shared';
import { Tile } from '../../components/ui/Tile';
import { formatNumber } from '../../lib/format';
import { useLive } from './queries';
import styles from './Websites.module.css';

export interface LiveCounterProps {
  filters: StatsFilters;
}

/** "On the site right now": distinct visitors in the last 5 minutes, polled every 15 s (§9). */
export function LiveCounter({ filters }: LiveCounterProps) {
  const { data: count } = useLive(filters);
  return (
    <Tile
      label={
        <>
          <span className={styles.pulse} aria-hidden="true">
            <i />
            <b />
          </span>
          On the site right now
        </>
      }
      value={count === undefined ? '–' : formatNumber(count)}
      delta={<span className={styles.livenote}>updates every few seconds</span>}
    />
  );
}
