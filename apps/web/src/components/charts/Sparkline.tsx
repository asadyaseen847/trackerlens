export interface SparklineProps {
  /** Daily values, oldest first (14 for site cards). */
  values: ReadonlyArray<number>;
  /** CSS color, e.g. "var(--t-direct)". */
  color: string;
}

/** Tiny line chart for site cards, as in the prototype. Decorative: the number is next to it. */
export function Sparkline({ values, color }: SparklineProps) {
  if (values.length < 2) return null;
  const max = Math.max(...values);
  const min = Math.min(...values);
  const points = values
    .map((v, i) => {
      const x = ((i / (values.length - 1)) * 200).toFixed(1);
      const y = (30 - ((v - min) / Math.max(1, max - min)) * 26).toFixed(1);
      return `${x},${y}`;
    })
    .join(' ');
  return (
    <svg
      viewBox="0 0 200 34"
      preserveAspectRatio="none"
      aria-hidden="true"
      width="100%"
      height="34"
    >
      <polyline
        points={points}
        fill="none"
        style={{ stroke: color, strokeWidth: 2.5 }}
        vectorEffect="non-scaling-stroke"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}
