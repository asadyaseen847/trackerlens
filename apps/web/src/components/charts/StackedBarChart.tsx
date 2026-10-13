import {
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent,
} from 'react';
import { formatAxis, formatNumber } from '../../lib/format';
import styles from './StackedBarChart.module.css';

export interface ChartSeriesKey {
  id: string;
  label: string;
  /** CSS custom property with the series color, e.g. "--t-social". */
  colorVar: string;
}

export interface ChartBucket {
  label: string;
  fullLabel: string;
  partial: boolean;
  /** Value per series id. */
  values: Record<string, number>;
}

export interface StackedBarChartProps {
  /** Accessible name, e.g. "Visits per day". */
  title: string;
  /** Unit in the tooltip and announcements: "visits", "views". */
  unit: string;
  /** Bottom-to-top stacking order. */
  keys: ReadonlyArray<ChartSeriesKey>;
  buckets: ReadonlyArray<ChartBucket>;
  /** Shown instead of the chart when every value is 0. */
  emptyText: string;
}

const TIP_WIDTH = 250;

function niceScale(max: number, ticks: number) {
  const raw = max / ticks;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const n = raw / mag;
  const step = (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * mag;
  return { step, top: step * Math.ceil(max / step) };
}

/**
 * Hand-built SVG stacked bars, ported from the prototype (§12): 2 px gaps between segments,
 * only the top segment rounded, striped partial bucket, one y-axis, gridlines in the line
 * color. Hover or tap shows a tooltip; arrow keys move between bars with a polite
 * live-region announcement (§11).
 */
export function StackedBarChart({ title, unit, keys, buckets, emptyText }: StackedBarChartProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const [hoverState, setHover] = useState<number | null>(null);
  const [announcement, setAnnouncement] = useState('');
  const patternId = `hatch-${useId().replace(/:/g, '')}`;

  useLayoutEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    // The observer also fires once right away with the initial size.
    const observer = new ResizeObserver(() => setWidth(host.clientWidth));
    observer.observe(host);
    return () => observer.disconnect();
  }, []);

  const W = Math.max(280, Math.round(width || 280));
  const narrow = W < 560;
  const H = narrow ? 250 : 310;
  const m = { l: 50, r: 8, t: 14, b: 36 };
  const pw = W - m.l - m.r;
  const ph = H - m.t - m.b;
  const n = buckets.length;
  // A hovered bar that no longer exists (the data changed shape) counts as no hover.
  const hover = hoverState !== null && hoverState < n ? hoverState : null;
  const band = n > 0 ? pw / n : pw;
  const bw = Math.max(3, Math.min(band * 0.68, 72));
  const totals = buckets.map((b) => keys.reduce((s, k) => s + (b.values[k.id] ?? 0), 0));
  const max = Math.max(0, ...totals);
  const scale = max > 0 ? niceScale(max, narrow ? 3 : 4) : { step: 1, top: 1 };
  const Y = (v: number) => m.t + ph - (v / scale.top) * ph;
  const every = Math.max(1, Math.ceil(n / Math.max(1, Math.floor(pw / (narrow ? 58 : 66)))));

  function indexAt(clientX: number) {
    const host = hostRef.current;
    if (!host) return null;
    const i = Math.floor((clientX - host.getBoundingClientRect().left - m.l) / band);
    return Math.min(n - 1, Math.max(0, i));
  }

  function onPointer(e: PointerEvent<HTMLDivElement>) {
    if (n > 0) setHover(indexAt(e.clientX));
  }

  function announce(i: number) {
    const b = buckets[i];
    if (!b) return;
    const parts = keys.map((k) => `${k.label} ${formatNumber(b.values[k.id] ?? 0)}`).join(', ');
    setAnnouncement(`${b.fullLabel}: ${formatNumber(totals[i] ?? 0)} ${unit}. ${parts}.`);
  }

  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    if (n === 0) return;
    let next = hover;
    if (e.key === 'ArrowRight') next = hover === null ? 0 : Math.min(n - 1, hover + 1);
    else if (e.key === 'ArrowLeft') next = hover === null ? n - 1 : Math.max(0, hover - 1);
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = n - 1;
    else if (e.key === 'Escape') next = null;
    else return;
    e.preventDefault();
    setHover(next);
    if (next !== null) announce(next);
  }

  const hovered = hover !== null ? buckets[hover] : undefined;
  // Tooltip to the right of the bar, or to its left when it would run off the chart.
  const cx = hover !== null ? m.l + hover * band + band / 2 : 0;
  const tipStyle =
    cx + 16 + TIP_WIDTH > W
      ? { left: Math.max(0, cx - 16), transform: 'translateX(-100%)' }
      : { left: cx + 16 };

  return (
    <>
      {/*
        The chart is a picture (role="img") that keyboard users read bar by bar with the arrow
        keys, announced in the live region below, so it is focusable and handles keys, as in
        the prototype.
      */}
      {/* eslint-disable jsx-a11y/no-noninteractive-tabindex, jsx-a11y/no-noninteractive-element-interactions */}
      <div
        ref={hostRef}
        className={styles.chart}
        tabIndex={0}
        role="img"
        aria-label={`${title}. Use the left and right arrow keys to read each bar.`}
        onPointerMove={onPointer}
        onPointerDown={onPointer}
        onPointerLeave={(e) => {
          if (e.pointerType === 'mouse') setHover(null);
        }}
        onBlur={() => setHover(null)}
        onKeyDown={onKeyDown}
      >
        {/* eslint-enable jsx-a11y/no-noninteractive-tabindex, jsx-a11y/no-noninteractive-element-interactions */}
        {max <= 0 ? (
          <div className={styles.empty}>{emptyText}</div>
        ) : (
          <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} aria-hidden="true">
            <defs>
              <pattern
                id={patternId}
                width="7"
                height="7"
                patternUnits="userSpaceOnUse"
                patternTransform="rotate(45)"
              >
                <line x1="0" y1="0" x2="0" y2="7" className={styles.hatch} />
              </pattern>
            </defs>

            {Array.from(
              { length: Math.round(scale.top / scale.step) + 1 },
              (_, i) => i * scale.step,
            ).map((v) => (
              <g key={v}>
                {v > 0 && (
                  <line className={styles.grid} x1={m.l} x2={W - m.r} y1={Y(v)} y2={Y(v)} />
                )}
                <text className={styles.ax} x={m.l - 10} y={Y(v) + 4} textAnchor="end">
                  {formatAxis(v)}
                </text>
              </g>
            ))}

            {buckets.map((b, i) => {
              const x0 = m.l + i * band + (band - bw) / 2;
              const segments = keys.filter((k) => (b.values[k.id] ?? 0) > 0);
              let acc = 0;
              return (
                <g key={i} opacity={hover !== null && hover !== i ? 0.32 : 1}>
                  {segments.map((k, s) => {
                    const v = b.values[k.id] ?? 0;
                    const yTop = Y(acc + v);
                    const yBot = Y(acc) - (s > 0 ? 2 : 0);
                    acc += v;
                    const h = Math.max(0, yBot - yTop);
                    if (h <= 0) return null;
                    const fill = { fill: `var(${k.colorVar})` };
                    if (s === segments.length - 1) {
                      const r = Math.min(4, bw / 2, h);
                      return (
                        <path
                          key={k.id}
                          style={fill}
                          d={`M${x0},${yBot}V${yTop + r}Q${x0},${yTop} ${x0 + r},${yTop}H${x0 + bw - r}Q${x0 + bw},${yTop} ${x0 + bw},${yTop + r}V${yBot}Z`}
                        />
                      );
                    }
                    return <rect key={k.id} style={fill} x={x0} y={yTop} width={bw} height={h} />;
                  })}
                  {b.partial && (totals[i] ?? 0) > 0 && (
                    <rect
                      x={x0}
                      y={Y(totals[i] ?? 0)}
                      width={bw}
                      height={Y(0) - Y(totals[i] ?? 0)}
                      fill={`url(#${patternId})`}
                    />
                  )}
                </g>
              );
            })}

            <line className={styles.base} x1={m.l} x2={W - m.r} y1={Y(0)} y2={Y(0)} />

            {buckets.map((b, i) => {
              const show =
                (i % every === 0 &&
                  !(hover !== null && i !== hover && Math.abs(i - hover) < every)) ||
                i === hover;
              if (!show) return null;
              return (
                <text
                  key={i}
                  className={i === hover ? `${styles.ax} ${styles.axOn}` : styles.ax}
                  x={m.l + i * band + band / 2}
                  y={H - m.b + 22}
                  textAnchor="middle"
                >
                  {b.label}
                </text>
              );
            })}
          </svg>
        )}

        {hovered && hover !== null && max > 0 && (
          <div className={styles.tip} style={tipStyle}>
            <div className={styles.tipDate}>{hovered.fullLabel}</div>
            <div className={styles.tipTotal}>
              {formatNumber(totals[hover] ?? 0)} {unit}
            </div>
            {[...keys].reverse().map((k) => (
              <div key={k.id} className={styles.tipRow}>
                <span className={styles.sw} style={{ background: `var(${k.colorVar})` }} />
                <span>{k.label}</span>
                <span>{formatNumber(hovered.values[k.id] ?? 0)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
      <div className="sr-only" aria-live="polite">
        {announcement}
      </div>
    </>
  );
}
