import type { Period, SocialAccountsResponse, SocialOverviewResponse } from '@audience/shared';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';

export const socialKeys = {
  all: ['social'] as const,
  accounts: () => [...socialKeys.all, 'accounts'] as const,
  overview: (period: Period) => [...socialKeys.all, 'overview', period] as const,
};

export function useSocialAccounts() {
  return useQuery({
    queryKey: socialKeys.accounts(),
    queryFn: () => api<SocialAccountsResponse>('/social/accounts'),
  });
}

export function useSocialOverview(period: Period) {
  return useQuery({
    queryKey: socialKeys.overview(period),
    queryFn: () => api<SocialOverviewResponse>('/social/overview', { query: { period } }),
    placeholderData: keepPreviousData,
  });
}

export function useDisconnect() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (accountId: string) =>
      api<void>(`/social/accounts/${accountId}`, { method: 'DELETE' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: socialKeys.all }),
  });
}

/** Full-page navigation to the platform's sign-in (or straight back, for sample data). */
export function startConnect(platform: string): void {
  window.location.assign(`${import.meta.env['VITE_API_URL'] ?? '/api'}/social/connect/${platform}`);
}
