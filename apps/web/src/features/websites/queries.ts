import type {
  CreateSiteBody,
  SiteDto,
  SitesResponse,
  StatsFilters,
  UpdateSiteBody,
} from '@audience/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';

export const websitesKeys = {
  all: ['websites'] as const,
  sites: () => [...websitesKeys.all, 'sites'] as const,
  // TODO(Phase 3, §10): useOverview, useBreakdown, useLive.
  overview: (filters: StatsFilters) => [...websitesKeys.all, 'overview', filters] as const,
  breakdown: (filters: StatsFilters, dimension: string) =>
    [...websitesKeys.all, 'breakdown', dimension, filters] as const,
  live: (site: string) => [...websitesKeys.all, 'live', site] as const,
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
    onSuccess: () => queryClient.invalidateQueries({ queryKey: websitesKeys.sites() }),
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
    onSuccess: () => queryClient.invalidateQueries({ queryKey: websitesKeys.sites() }),
  });
}
