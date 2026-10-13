import { CHANNELS, type BreakdownRow as Row, type StatsFilters } from '@audience/shared';
import { BreakdownPanel } from '../../components/breakdown/BreakdownPanel';
import { BreakdownRow } from '../../components/breakdown/BreakdownRow';
import styles from '../../components/breakdown/Breakdown.module.css';
import { countryName, deviceLabel } from '../../lib/format';
import { useBreakdown } from './queries';
import pageStyles from './Websites.module.css';

const CHANNEL_VAR = new Map(CHANNELS.map((c) => [c.id, `var(${c.cssVar})`]));
const CHANNEL_LABEL = new Map(CHANNELS.map((c) => [c.id, c.label]));
const maxShare = (rows: ReadonlyArray<Row> | undefined) =>
  Math.max(0, ...(rows ?? []).map((r) => r.share));

export interface BreakdownsProps {
  filters: StatsFilters;
  /** Show the domain next to page paths when several sites are shown. */
  multiSite: boolean;
  platforms: ReadonlyArray<Row> | undefined;
  platformsLoading: boolean;
}

/** Platforms, Top pages, Campaigns, Countries, Devices (§11). */
export function Breakdowns({ filters, multiSite, platforms, platformsLoading }: BreakdownsProps) {
  const pages = useBreakdown(filters, 'page', 8);
  const campaigns = useBreakdown(filters, 'campaign', 8);
  const countries = useBreakdown(filters, 'country', 10);
  const devices = useBreakdown(filters, 'device', 3);

  const swatch = (row: Row) => {
    const color = row.channel ? CHANNEL_VAR.get(row.channel) : undefined;
    return color ? (
      <span
        className={styles.sw}
        style={{ background: color }}
        title={row.channel ? CHANNEL_LABEL.get(row.channel) : undefined}
      />
    ) : null;
  };

  return (
    <section className={pageStyles.where} aria-label="Where visits came from">
      <BreakdownPanel
        title="Platforms"
        sub="Which platform sent each visit"
        loading={platformsLoading}
        emptyText="No visits for this filter."
      >
        {(platforms ?? []).map((r) => (
          <BreakdownRow
            key={r.key}
            name={
              <>
                {swatch(r)}
                <span className={styles.txt}>{r.label}</span>
              </>
            }
            value={r.value}
            changePct={r.changePct}
            share={r.share}
            maxShare={maxShare(platforms)}
            color={(r.channel && CHANNEL_VAR.get(r.channel)) || 'var(--single)'}
          />
        ))}
      </BreakdownPanel>

      <BreakdownPanel
        title="Top pages"
        sub="Pages people looked at most"
        loading={pages.isPending}
        emptyText="No page views for this filter."
      >
        {(pages.data ?? []).map((r) => (
          <BreakdownRow
            key={r.key}
            name={
              <span className={styles.txt}>
                {multiSite && r.detail && <span className={styles.host}>{r.detail}</span>}
                {r.label}
              </span>
            }
            value={r.value}
            changePct={r.changePct}
            share={r.share}
            maxShare={maxShare(pages.data)}
            color="var(--single)"
          />
        ))}
      </BreakdownPanel>

      <BreakdownPanel
        title="Campaigns"
        sub="Links with campaign tags"
        loading={campaigns.isPending}
        emptyText="No tagged links for the traffic types shown. The link builder in Install code makes them."
      >
        {(campaigns.data ?? []).map((r) => (
          <BreakdownRow
            key={r.key}
            name={
              <>
                {swatch(r)}
                <span className={styles.txt}>
                  {r.label}
                  {r.detail && <span className={styles.host}> · {r.detail}</span>}
                </span>
              </>
            }
            value={r.value}
            changePct={r.changePct}
            share={r.share}
            maxShare={maxShare(campaigns.data)}
            color={(r.channel && CHANNEL_VAR.get(r.channel)) || 'var(--single)'}
          />
        ))}
      </BreakdownPanel>

      <BreakdownPanel
        title="Countries"
        sub="Where visitors are"
        loading={countries.isPending}
        emptyText="No visits for this filter."
      >
        {(countries.data ?? []).map((r) => (
          <BreakdownRow
            key={r.key}
            name={
              <>
                <span className={styles.code}>{r.key === 'XX' ? '··' : r.key}</span>
                <span className={styles.txt}>{countryName(r.key)}</span>
              </>
            }
            value={r.value}
            changePct={r.changePct}
            share={r.share}
            maxShare={maxShare(countries.data)}
            color="var(--single)"
            dimmed={!!filters.country && filters.country !== r.key}
          />
        ))}
      </BreakdownPanel>

      <BreakdownPanel
        title="Devices"
        sub="What they used to visit"
        loading={devices.isPending}
        emptyText="No visits for this filter."
      >
        {(devices.data ?? []).map((r) => (
          <BreakdownRow
            key={r.key}
            name={<span className={styles.txt}>{deviceLabel(r.key)}</span>}
            value={r.value}
            changePct={r.changePct}
            share={r.share}
            maxShare={maxShare(devices.data)}
            color="var(--single)"
            dimmed={!!filters.device && filters.device !== r.key}
          />
        ))}
      </BreakdownPanel>
    </section>
  );
}
