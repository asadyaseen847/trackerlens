import type { Period } from '@audience/shared';

// TODO(Phase 4, §10): useSocialAccounts, useSocialOverview, useDisconnect.
export const socialKeys = {
  all: ['social'] as const,
  accounts: () => [...socialKeys.all, 'accounts'] as const,
  overview: (period: Period) => [...socialKeys.all, 'overview', period] as const,
};
