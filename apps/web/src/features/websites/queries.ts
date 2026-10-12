import type { StatsFilters } from '@audience/shared';

// TODO(Phase 1, §10): useSites, useCreateSite. TODO(Phase 3, §10): useOverview, useBreakdown, useLive.
export const websitesKeys = {
  all: ['websites'] as const,
  sites: () => [...websitesKeys.all, 'sites'] as const,
  overview: (filters: StatsFilters) => [...websitesKeys.all, 'overview', filters] as const,
  breakdown: (filters: StatsFilters, dimension: string) =>
    [...websitesKeys.all, 'breakdown', dimension, filters] as const,
  live: (site: string) => [...websitesKeys.all, 'live', site] as const,
};
