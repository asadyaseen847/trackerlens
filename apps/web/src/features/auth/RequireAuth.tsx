import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router';
import { EmptyState } from '../../components/ui/EmptyState';
import { Skeleton } from '../../components/ui/Skeleton';
import { useMe } from './useAuth';
import styles from './Auth.module.css';

/** Renders its children only for signed-in users; everyone else goes to /login. */
export function RequireAuth({ children }: { children: ReactNode }) {
  const { data: me, isPending, isError, refetch } = useMe();
  const location = useLocation();

  if (isPending) {
    return (
      <div className={styles.loading} aria-busy="true">
        <span className="sr-only">Loading…</span>
        <Skeleton height={40} width={220} />
        <Skeleton height={46} />
        <Skeleton height={180} radius={22} />
      </div>
    );
  }

  if (isError) {
    return (
      <div className={styles.loading}>
        <EmptyState
          title="We couldn’t reach the server"
          body="Check your internet connection, then try again."
          action={
            <button type="button" className={styles.retry} onClick={() => void refetch()}>
              Try again
            </button>
          }
        />
      </div>
    );
  }

  if (!me) {
    return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  }

  return <>{children}</>;
}
