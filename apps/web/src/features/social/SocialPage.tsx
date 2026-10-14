import { SOCIAL_PLATFORMS, statsQuerySchema, type Period } from '@audience/shared';
import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { StackedBarChart, type ChartBucket } from '../../components/charts/StackedBarChart';
import { ChartTable } from '../../components/charts/ChartTable';
import { DeltaChip } from '../../components/ui/DeltaChip';
import { Panel } from '../../components/ui/Panel';
import { SegmentedControl } from '../../components/ui/SegmentedControl';
import { Skeleton } from '../../components/ui/Skeleton';
import { Tile } from '../../components/ui/Tile';
import { useToast } from '../../components/ui/Toast';
import { formatBig, formatNumber } from '../../lib/format';
import { useSocialOverview } from './queries';
import { SocialCards } from './SocialCards';
import styles from './Social.module.css';
import { ViewsToVisitsTable } from './ViewsToVisitsTable';

const PERIODS: ReadonlyArray<{ value: Period; label: string }> = [
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'yearly', label: 'Yearly' },
];
const META = new Map(SOCIAL_PLATFORMS.map((p) => [p.id, p]));

/** The Social media page (§11, §13), matching docs/design/prototype.html. */
export function SocialPage() {
  const [params, setParams] = useSearchParams();
  const toast = useToast();
  const parsed = statsQuerySchema.shape.period.safeParse(params.get('period') ?? undefined);
  const period: Period = parsed.success ? parsed.data : 'daily';
  const overview = useSocialOverview(period);
  const data = overview.data;
  const [mode, setMode] = useState<'chart' | 'table'>('chart');

  // Back from connecting: say how it went, then tidy the URL.
  useEffect(() => {
    const connected = params.get('connected');
    const failed = params.get('error');
    if (!connected && !failed) return;
    const label = META.get((connected ?? failed) as never)?.label ?? 'The account';
    toast(connected ? `${label} connected` : `${label} couldn’t be connected. Please try again.`);
    const next = new URLSearchParams(params);
    next.delete('connected');
    next.delete('error');
    setParams(next, { replace: true });
  }, [params, setParams, toast]);

  const connected = useMemo(() => (data?.platforms ?? []).filter((p) => p.account), [data]);
  const keys = connected.map((p) => ({
    id: p.platform,
    label: META.get(p.platform)?.label ?? p.platform,
    colorVar: META.get(p.platform)?.cssVar ?? '--single',
  }));
  const buckets: ChartBucket[] = (data?.series ?? []).map((b) => ({
    label: b.label,
    fullLabel: b.fullLabel,
    partial: b.partial,
    values: b.byPlatform as Record<string, number>,
  }));

  const mostViews = [...connected].sort((a, b) => b.views - a.views)[0];
  const best = data?.viewsToVisits[0];

  return (
    <>
      <div className={styles.headrow}>
        <div>
          <div className={styles.titleLine}>
            <h1>Your social media audience</h1>
            {data?.sampleData && <span className={styles.badge}>Sample data</span>}
          </div>
          <p className={styles.insight}>
            {!data ? (
              ' '
            ) : !mostViews ? (
              'Connect a social account to see its audience here.'
            ) : (
              <>
                <b>{META.get(mostViews.platform)?.label}</b> got the most views.
                {best && best.platform !== mostViews.platform ? (
                  <>
                    {' '}
                    <b>{META.get(best.platform)?.label}</b> turns views into website visits best:{' '}
                    {best.visitsPer1000Views.toFixed(1)} visits per 1,000 views.
                  </>
                ) : best ? (
                  <>
                    {' '}
                    It also sends the most visits per view: {best.visitsPer1000Views.toFixed(1)} per
                    1,000 views.
                  </>
                ) : null}
              </>
            )}
          </p>
        </div>
        <SegmentedControl
          label="Group social numbers by"
          options={PERIODS}
          value={period}
          onChange={(p) => {
            const next = new URLSearchParams(params);
            if (p === 'daily') next.delete('period');
            else next.set('period', p);
            setParams(next, { replace: true });
          }}
        />
      </div>

      {data && (
        <p className={styles.range}>
          Showing <b>{data.rangeLabel}</b> · changes compared with {data.compareLabel}
        </p>
      )}

      <section className={styles.kpis} aria-label="Social media totals">
        {data ? (
          <>
            <Tile
              hot
              label="Followers, all platforms"
              value={formatBig(data.totals.followers.value)}
              title={formatNumber(data.totals.followers.value)}
              delta={<DeltaChip changePct={data.totals.followers.changePct} />}
            />
            <Tile
              label="New followers"
              value={formatBig(data.totals.newFollowers.value)}
              title={formatNumber(data.totals.newFollowers.value)}
              delta={<DeltaChip changePct={data.totals.newFollowers.changePct} />}
            />
            <Tile
              label="Post views"
              value={formatBig(data.totals.views.value)}
              title={formatNumber(data.totals.views.value)}
              delta={<DeltaChip changePct={data.totals.views.changePct} />}
            />
            <Tile
              label="Visits to your websites"
              value={formatBig(data.totals.visits.value)}
              title={formatNumber(data.totals.visits.value)}
              delta={<DeltaChip changePct={data.totals.visits.changePct} />}
            />
          </>
        ) : (
          Array.from({ length: 4 }, (_, i) => <Skeleton key={i} height={140} radius={20} />)
        )}
      </section>

      {data ? (
        <SocialCards platforms={data.platforms} available={data.available} />
      ) : (
        <Skeleton height={260} radius={20} />
      )}

      <Panel
        title={`Post views per ${data?.unit ?? 'day'}`}
        sub="Connected platforms only. Hover or tap a bar for details."
        actions={
          <SegmentedControl
            label="Show as"
            size="small"
            options={[
              { value: 'chart', label: 'Chart' },
              { value: 'table', label: 'Table' },
            ]}
            value={mode}
            onChange={setMode}
          />
        }
      >
        {keys.length > 0 && (
          <div className={styles.legend} aria-label="Legend">
            {keys.map((k) => (
              <span key={k.id} className={styles.legendItem}>
                <span
                  className={styles.sw}
                  style={{ background: `var(${k.colorVar})`, width: 12, height: 12 }}
                />
                {k.label}
              </span>
            ))}
          </div>
        )}
        {!data ? (
          <Skeleton height={280} radius={14} />
        ) : mode === 'chart' ? (
          <StackedBarChart
            title={`Post views per ${data.unit}, by platform`}
            unit="views"
            keys={keys}
            buckets={buckets}
            emptyText="Connect a social account to see views here."
          />
        ) : (
          <ChartTable caption={`Post views per ${data.unit}`} keys={keys} buckets={buckets} />
        )}
      </Panel>

      <Panel
        title="From social post to website visit"
        sub="Which platform turns views into visits best"
      >
        {data ? (
          <ViewsToVisitsTable rows={data.viewsToVisits} />
        ) : (
          <Skeleton height={180} radius={14} />
        )}
        <p className={styles.note}>
          Instagram and TikTok often hide where a visitor came from. Add campaign tags to the links
          you share there; the <Link to="/app/install">link builder</Link> in Install code makes
          them for you.
        </p>
      </Panel>
    </>
  );
}
