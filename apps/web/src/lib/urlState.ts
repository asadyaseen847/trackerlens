import type { StatsFilters } from '@audience/shared';

export const DEFAULT_FILTERS: StatsFilters = { site: 'all', period: 'daily' };

/**
 * Read filters from ?site=&period=&channels=&device=&country=.
 * TODO(Phase 3, §11): parse and validate each value (zod), falling back to defaults.
 */
export function readFilters(_params: URLSearchParams): StatsFilters {
  return DEFAULT_FILTERS;
}

/**
 * Write filters back to the query string, omitting defaults.
 * TODO(Phase 3, §11): implement.
 */
export function writeFilters(_filters: StatsFilters): URLSearchParams {
  return new URLSearchParams();
}
