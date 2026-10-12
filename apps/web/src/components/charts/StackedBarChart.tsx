import styles from './StackedBarChart.module.css';

export interface ChartSeriesKey {
  id: string;
  label: string;
  /** Token such as "var(--t-social)". */
  color: string;
}

export interface ChartBucket {
  label: string;
  fullLabel: string;
  partial: boolean;
  values: Record<string, number>;
}

export interface StackedBarChartProps {
  /** Accessible name, e.g. "Visits per day". */
  title: string;
  keys: ReadonlyArray<ChartSeriesKey>;
  buckets: ReadonlyArray<ChartBucket>;
}

/**
 * Hand-built SVG stacked bars, ported from the prototype.
 * TODO(Phase 3, §11, §12): bars with 2 px gaps, rounded top segment, striped partial bucket,
 * one y-axis, gridlines, legend, tooltip, arrow-key navigation with a live region.
 */
export function StackedBarChart({ title, buckets }: StackedBarChartProps) {
  return (
    <div className={styles.empty} role="img" aria-label={`${title}: chart coming in Phase 3`}>
      {buckets.length === 0 ? 'No data yet' : `${buckets.length} buckets`}
    </div>
  );
}
