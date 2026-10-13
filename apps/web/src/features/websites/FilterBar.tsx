import { CHANNELS, type Channel, type Device, type StatsFilters } from '@audience/shared';
import { Chip } from '../../components/ui/Chip';
import { Select } from '../../components/ui/Select';
import { countryName } from '../../lib/format';
import styles from './Websites.module.css';

export interface FilterBarProps {
  filters: StatsFilters;
  onChange: (filters: StatsFilters) => void;
  /** Country codes present in the data, most visits first. */
  countries: ReadonlyArray<string>;
}

const ALL_CHANNELS = CHANNELS.map((c) => c.id);

/**
 * Device and country selects, and one chip per channel (aria-pressed). At least one channel
 * always stays on; "Show all" appears when some are off (§11).
 */
export function FilterBar({ filters, onChange, countries }: FilterBarProps) {
  const active = new Set<Channel>(filters.channels ?? ALL_CHANNELS);

  function toggle(channel: Channel) {
    const next = new Set(active);
    if (next.has(channel)) {
      if (next.size === 1) return; // keep at least one on
      next.delete(channel);
    } else next.add(channel);
    const list = ALL_CHANNELS.filter((c) => next.has(c));
    const { channels: _drop, ...rest } = filters;
    onChange(list.length === ALL_CHANNELS.length ? rest : { ...rest, channels: list });
  }

  function set(key: 'device' | 'country', value: string) {
    const next: StatsFilters = { ...filters };
    delete next[key];
    if (key === 'device' && value !== 'all') next.device = value as Device;
    if (key === 'country' && value !== 'all') next.country = value;
    onChange(next);
  }

  const countryOptions = [
    { value: 'all', label: 'All countries' },
    ...[...new Set([...(filters.country ? [filters.country] : []), ...countries])].map((code) => ({
      value: code,
      label: countryName(code),
    })),
  ];

  return (
    <div className={styles.toolbar}>
      <Select
        label="Device"
        value={filters.device ?? 'all'}
        options={[
          { value: 'all', label: 'All devices' },
          { value: 'phone', label: 'Phone' },
          { value: 'desktop', label: 'Desktop' },
          { value: 'tablet', label: 'Tablet' },
        ]}
        onChange={(v) => set('device', v)}
      />
      <Select
        label="Country"
        value={filters.country ?? 'all'}
        options={countryOptions}
        onChange={(v) => set('country', v)}
      />
      <div className={styles.chips} role="group" aria-label="Traffic types">
        {CHANNELS.map((c) => (
          <Chip
            key={c.id}
            label={c.label}
            color={`var(${c.cssVar})`}
            pressed={active.has(c.id)}
            onToggle={() => toggle(c.id)}
          />
        ))}
        {active.size < ALL_CHANNELS.length && (
          <button
            type="button"
            className={styles.showAll}
            onClick={() => {
              const { channels: _drop, ...rest } = filters;
              onChange(rest);
            }}
          >
            Show all
          </button>
        )}
      </div>
    </div>
  );
}
