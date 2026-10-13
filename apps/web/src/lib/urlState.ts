import { statsQuerySchema, type Channel, type StatsFilters } from '@audience/shared';
import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router';

export const DEFAULT_FILTERS: StatsFilters = { site: 'all', period: 'daily' };

/**
 * Read filters from ?site=&period=&channels=&device=&country= (§11). Invalid values fall back
 * to the defaults one by one, so a bad link still shows something sensible.
 */
export function readFilters(params: URLSearchParams): StatsFilters {
  const pick = (key: keyof StatsFilters) => {
    const raw = params.get(key);
    if (raw === null) return undefined;
    const parsed = statsQuerySchema.shape[key].safeParse(raw);
    return parsed.success ? parsed.data : undefined;
  };
  const filters: StatsFilters = {
    site: (pick('site') as string | undefined) ?? 'all',
    period: (pick('period') as StatsFilters['period'] | undefined) ?? 'daily',
  };
  const channels = pick('channels') as Channel[] | undefined;
  const device = pick('device') as StatsFilters['device'];
  const country = pick('country') as string | undefined;
  if (channels) filters.channels = channels;
  if (device) filters.device = device;
  if (country) filters.country = country;
  return filters;
}

/** Filters as a query string, omitting defaults. */
export function writeFilters(filters: StatsFilters): URLSearchParams {
  const params = new URLSearchParams();
  if (filters.site !== 'all') params.set('site', filters.site);
  if (filters.period !== 'daily') params.set('period', filters.period);
  if (filters.channels?.length) params.set('channels', filters.channels.join(','));
  if (filters.device) params.set('device', filters.device);
  if (filters.country) params.set('country', filters.country);
  return params;
}

/** Same filters as the API's query object (only set keys). */
export function filtersToQuery(filters: StatsFilters): Record<string, string> {
  return Object.fromEntries(writeFilters(filters));
}

/** The dashboard filters, kept in the URL so views can be shared and survive a reload. */
export function useFilters(): [StatsFilters, (next: StatsFilters) => void] {
  const [params, setParams] = useSearchParams();
  const filters = useMemo(() => readFilters(params), [params]);
  const setFilters = useCallback(
    (next: StatsFilters) => setParams(writeFilters(next), { replace: true }),
    [setParams],
  );
  return [filters, setFilters];
}
