import type {
  BreakdownDimension,
  BreakdownResponse,
  CreateSiteBody,
  LiveResponse,
  OverviewResponse,
  SiteDto,
  SitesResponse,
  StatsFilters,
  UpdateSiteBody,
} from '@audience/shared';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { filtersToQuery } from '../../lib/urlState';

export const websitesKeys = {
  all: ['websites'] as const,
  sites: () => [...websitesKeys.all, 'sites'] as const,
  overview: (filters: StatsFilters) => [...websitesKeys.all, 'overview', filters] as const,
  breakdown: (filters: StatsFilters, dimension: string, limit: number) =>
    [...websitesKeys.all, 'breakdown', dimension, limit, filters] as const,
  live: (filters: StatsFilters) => [...websitesKeys.all, 'live', filters] as const,
};

export function useSites() {
  return useQuery({
    queryKey: websitesKeys.sites(),
    queryFn: () => api<SitesResponse>('/sites'),
    select: (data) => data.sites,
  });
}

export function useCreateSite() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: CreateSiteBody) =>
      api<SiteDto>('/sites', { method: 'POST', body: { ...body } }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: websitesKeys.all }),
  });
}

export function useUpdateSite() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: UpdateSiteBody & { id: string }) =>
      api<SiteDto>(`/sites/${id}`, { method: 'PATCH', body }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: websitesKeys.sites() }),
  });
}

export function useDeleteSite() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api<void>(`/sites/${id}`, { method: 'DELETE' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: websitesKeys.all }),
  });
}

/** KPIs and the per-bucket series for the current filters. */
export function useOverview(filters: StatsFilters) {
  return useQuery({
    queryKey: websitesKeys.overview(filters),
    queryFn: () => api<OverviewResponse>('/stats/overview', { query: filtersToQuery(filters) }),
    placeholderData: keepPreviousData,
  });
}

export function useBreakdown(filters: StatsFilters, dimension: BreakdownDimension, limit = 10) {
  return useQuery({
    queryKey: websitesKeys.breakdown(filters, dimension, limit),
    queryFn: () =>
      api<BreakdownResponse>('/stats/breakdown', {
        query: { ...filtersToQuery(filters), dimension, limit },
      }),
    select: (data) => data.rows,
    placeholderData: keepPreviousData,
  });
}

/** "On the site right now", refreshed every 15 seconds (§9). */
export function useLive(filters: StatsFilters) {
  return useQuery({
    queryKey: websitesKeys.live(filters),
    queryFn: () => api<LiveResponse>('/stats/live', { query: filtersToQuery(filters) }),
    refetchInterval: 15_000,
    staleTime: 0,
    select: (data) => data.count,
  });
}
