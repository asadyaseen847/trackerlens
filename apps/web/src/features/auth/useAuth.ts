import type { MeResponse } from '@audience/shared';

export interface AuthState {
  me: MeResponse | null;
  isLoading: boolean;
}

/**
 * Current user and workspace.
 * TODO(Phase 1, §10): useQuery(['me'], () => api('/auth/me')) + login/signup/logout mutations.
 */
export function useAuth(): AuthState {
  return { me: null, isLoading: false };
}
