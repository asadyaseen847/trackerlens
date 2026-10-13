import { formatNumber } from '../../lib/format';
import type { ChartBucket, ChartSeriesKey } from './StackedBarChart';
import styles from './ChartTable.module.css';

export interface ChartTableProps {
  caption: string;
  /** First column heading, e.g. "Period". */
  rowHeading?: string;
  keys: ReadonlyArray<ChartSeriesKey>;
  buckets: ReadonlyArray<ChartBucket>;
}

/** Table view of a chart (every chart has one, §12): newest first, totals at the bottom. */
export function ChartTable({ caption, rowHeading = 'Period', keys, buckets }: ChartTableProps) {
  const columnTotals = keys.map((k) => buckets.reduce((s, b) => s + (b.values[k.id] ?? 0), 0));
  const grand = columnTotals.reduce((a, b) => a + b, 0);
  return (
    <div className={styles.wrap}>
      <table className={styles.table}>
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr>
            <th scope="col">{rowHeading}</th>
            {keys.map((k) => (
              <th key={k.id} scope="col">
                {k.label}
              </th>
            ))}
            <th scope="col">Total</th>
          </tr>
        </thead>
        <tbody>
          {[...buckets].reverse().map((b) => {
            const total = keys.reduce((s, k) => s + (b.values[k.id] ?? 0), 0);
            return (
              <tr key={b.fullLabel}>
                <th scope="row">{b.fullLabel}</th>
                {keys.map((k) => (
                  <td key={k.id}>{formatNumber(b.values[k.id] ?? 0)}</td>
                ))}
                <td>
                  <b>{formatNumber(total)}</b>
                </td>
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr>
            <th scope="row">All shown</th>
            {columnTotals.map((v, i) => (
              <td key={keys[i]?.id ?? i}>{formatNumber(v)}</td>
            ))}
            <td>{formatNumber(grand)}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
