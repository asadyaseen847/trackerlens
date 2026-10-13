import { BRAND_NAME } from '@audience/shared';
import { Link } from 'react-router';
import { useMe } from '../../features/auth/useAuth';
import styles from './TopBar.module.css';

export interface TopBarProps {
  showSettings: boolean;
}

export function TopBar({ showSettings }: TopBarProps) {
  const { data: me } = useMe();
  // TODO(Phase 4, §13): "Sample data" badge while the mock social provider is in use.
  return (
    <header className={styles.topbar}>
      <Link to={me ? '/app/websites' : '/login'} className={styles.brand}>
        <span className={styles.logo} aria-hidden="true">
          <svg
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill="none"
            strokeWidth="2.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M4 18l5-6 4 4 7-9" />
          </svg>
        </span>
        {BRAND_NAME}
      </Link>
      {me && (
        <div className={styles.meta}>
          <span className={styles.workspace}>{me.workspace.name}</span>
          {showSettings && (
            <Link to="/app/settings" className={styles.settings}>
              Settings
            </Link>
          )}
        </div>
      )}
    </header>
  );
}
