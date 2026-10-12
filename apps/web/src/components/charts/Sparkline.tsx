export interface SparklineProps {
  /** Daily values, oldest first (14 for site cards). */
  values: ReadonlyArray<number>;
  label: string;
}

/**
 * Tiny line chart for site cards.
 * TODO(Phase 3, §11): port the prototype's sparkline path.
 */
export function Sparkline({ label }: SparklineProps) {
  return <svg width="100%" height="34" role="img" aria-label={label} />;
}
