import { Link } from 'react-router';
import styles from './TopBar.module.css';

export interface TopBarProps {
  showSettings: boolean;
}

export function TopBar({ showSettings }: TopBarProps) {
  // TODO(Phase 1, §11): real workspace name from /auth/me.
  // TODO(Phase 4, §13): show the badge only while SOCIAL_MOCK / sample data is in use.
  return (
    <header className={styles.topbar}>
      <Link to="/app/websites" className={styles.brand}>
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
        [YOUR BRAND]
      </Link>
      <div className={styles.meta}>
        <span className={styles.workspace}>[Customer company]</span>
        <span className={styles.badge}>Sample data</span>
        {showSettings && (
          <Link to="/app/settings" className={styles.settings}>
            Settings
          </Link>
        )}
      </div>
    </header>
  );
}
