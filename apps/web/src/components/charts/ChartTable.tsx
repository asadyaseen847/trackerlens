import type { ChartBucket, ChartSeriesKey } from './StackedBarChart';

export interface ChartTableProps {
  caption: string;
  keys: ReadonlyArray<ChartSeriesKey>;
  buckets: ReadonlyArray<ChartBucket>;
}

/**
 * Table view of a chart (every chart has one, §12).
 * TODO(Phase 3, §11): totals row, number formatting, prototype table styles.
 */
export function ChartTable({ caption, keys, buckets }: ChartTableProps) {
  return (
    <table>
      <caption className="sr-only">{caption}</caption>
      <thead>
        <tr>
          <th scope="col">Date</th>
          {keys.map((k) => (
            <th key={k.id} scope="col">
              {k.label}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {buckets.map((b) => (
          <tr key={b.fullLabel}>
            <th scope="row">{b.fullLabel}</th>
            {keys.map((k) => (
              <td key={k.id}>{b.values[k.id] ?? 0}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
