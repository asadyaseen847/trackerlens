import { CHANNELS, type Period, type StatsFilters } from '@audience/shared';
import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { ChartTable } from '../../components/charts/ChartTable';
import { StackedBarChart, type ChartBucket } from '../../components/charts/StackedBarChart';
import { Button } from '../../components/ui/Button';
import { EmptyState } from '../../components/ui/EmptyState';
import { Panel } from '../../components/ui/Panel';
import { SegmentedControl } from '../../components/ui/SegmentedControl';
import { Skeleton } from '../../components/ui/Skeleton';
import { filtersToQuery, useFilters } from '../../lib/urlState';
import { AddSiteDialog } from './AddSiteDialog';
import { Breakdowns } from './Breakdowns';
import { FilterBar } from './FilterBar';
import { Insight } from './Insight';
import { KpiRow } from './KpiRow';
import { useBreakdown, useOverview, useSites } from './queries';
import { SiteCards } from './SiteCards';
import styles from './Websites.module.css';

const PERIODS: ReadonlyArray<{ value: Period; label: string }> = [
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'yearly', label: 'Yearly' },
];

const CHANNEL_KEYS = CHANNELS.map((c) => ({ id: c.id, label: c.label, colorVar: c.cssVar }));

/** The Websites dashboard (§11), matching docs/design/prototype.html. */
export function WebsitesPage() {
  const [filters, setFilters] = useFilters();
  const sites = useSites();
  const [adding, setAdding] = useState(false);

  const selected = filters.site === 'all' ? null : sites.data?.find((s) => s.id === filters.site);
  const update = (patch: Partial<StatsFilters>) => setFilters({ ...filters, ...patch });

  if (sites.isPending) {
    return (
      <>
        <h1>Your website traffic</h1>
        <Skeleton height={150} radius={20} />
      </>
    );
  }

  if (!sites.data?.length) {
    return (
      <>
        <h1>Your website traffic</h1>
        <EmptyState
          title="Add your first website"
          body="Type its address and you’ll get a one-line code to paste into the site. Visits show up here once it’s installed."
          action={
            <Button variant="primary" onClick={() => setAdding(true)}>
              Add website
            </Button>
          }
        />
        <AddSiteDialog open={adding} onClose={() => setAdding(false)} />
      </>
    );
  }

  const waiting = selected ? !selected.firstEventAt : !sites.data.some((s) => s.firstEventAt);

  return (
    <>
      <div className={styles.headrow}>
        <div>
          <h1>{selected ? `Traffic for ${selected.domain}` : 'Your website traffic'}</h1>
          <p className={styles.insight}>
            {waiting ? (
              selected ? (
                'No visits yet for this website.'
              ) : (
                'No visits yet.'
              )
            ) : (
              <InsightLine filters={filters} where={selected?.domain ?? 'your websites'} />
            )}
          </p>
        </div>
        <SegmentedControl
          label="Group traffic by"
          options={PERIODS}
          value={filters.period}
          onChange={(period) => update({ period })}
        />
      </div>

      <SiteCards
        sites={sites.data}
        selected={selected ? selected.id : 'all'}
        onSelect={(site) => update({ site })}
        onAdd={() => setAdding(true)}
      />

      {waiting ? (
        <Waiting siteId={selected?.id} domain={selected?.domain} />
      ) : (
        <Dashboard
          filters={filters}
          onChange={setFilters}
          multiSite={!selected && sites.data.length > 1}
        />
      )}

      <AddSiteDialog open={adding} onClose={() => setAdding(false)} />
    </>
  );
}

function InsightLine({ filters, where }: { filters: StatsFilters; where: string }) {
  const platforms = useBreakdown(filters, 'platform', 10);
  return <Insight platforms={platforms.data} where={where} />;
}

function Waiting({ siteId, domain }: { siteId: string | undefined; domain: string | undefined }) {
  const navigate = useNavigate();
  return (
    <EmptyState
      title="Waiting for the first visit"
      body={`Add the tracking code to ${domain ?? 'your website'}. Visits show up here about a minute after someone opens the site.`}
      action={
        <Button
          variant="primary"
          onClick={() => void navigate(siteId ? `/app/install?site=${siteId}` : '/app/install')}
        >
          Get the code
        </Button>
      }
    />
  );
}

function Dashboard({
  filters,
  onChange,
  multiSite,
}: {
  filters: StatsFilters;
  onChange: (f: StatsFilters) => void;
  multiSite: boolean;
}) {
  const overview = useOverview(filters);
  const platforms = useBreakdown(filters, 'platform', 10);
  const countryList = useBreakdown(filters, 'country', 250);
  const [mode, setMode] = useState<'chart' | 'table'>('chart');
  const data = overview.data;

  const keys = useMemo(
    () =>
      filters.channels
        ? CHANNEL_KEYS.filter((k) => filters.channels?.includes(k.id as never))
        : CHANNEL_KEYS,
    [filters.channels],
  );
  const buckets: ChartBucket[] = useMemo(
    () =>
      (data?.series ?? []).map((b) => ({
        label: b.label,
        fullLabel: b.fullLabel,
        partial: b.partial,
        values: b.byChannel,
      })),
    [data],
  );
  const per = data?.unit ?? 'day';
  const csvHref = `/api/stats/export.csv?${new URLSearchParams(filtersToQuery(filters)).toString()}`;

  return (
    <div className={styles.body}>
      <FilterBar
        filters={filters}
        onChange={onChange}
        countries={(countryList.data ?? []).map((r) => r.key).filter((k) => k !== 'XX')}
      />
      {data && (
        <p className={styles.range}>
          Showing <b>{data.rangeLabel}</b> · changes compared with {data.compareLabel}
        </p>
      )}

      <KpiRow kpis={data?.kpis} filters={filters} />

      <Panel
        title={`Visits per ${per}`}
        sub="Each bar is split by type of traffic. Hover or tap a bar for details."
        actions={
          <div className={styles.panelActions}>
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
            <a className={styles.csv} href={csvHref} download>
              Download CSV
            </a>
          </div>
        }
      >
        {!data ? (
          <Skeleton height={280} radius={14} />
        ) : mode === 'chart' ? (
          <StackedBarChart
            title={`Visits per ${per}, split by type of traffic`}
            unit="visits"
            keys={keys}
            buckets={buckets}
            emptyText="No visits for this filter."
          />
        ) : (
          <ChartTable caption={`Visits per ${per}`} keys={keys} buckets={buckets} />
        )}
        {filters.period === 'yearly' && (
          <p className={styles.note}>This year’s bar is striped because the year isn’t over yet.</p>
        )}
        {filters.period !== 'yearly' && data?.series.some((b) => b.partial) && (
          <p className={styles.note}>
            The last bar is striped because this {per} isn’t over yet.{' '}
            <Link to="/app/install">Get the code</Link> for another website.
          </p>
        )}
      </Panel>

      <Breakdowns
        filters={filters}
        multiSite={multiSite}
        platforms={platforms.data}
        platformsLoading={platforms.isPending}
      />
    </div>
  );
}
