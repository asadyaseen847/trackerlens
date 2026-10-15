import { BRAND_NAME } from '@audience/shared';
import { Link, Outlet, useLocation } from 'react-router';
import styles from './AppShell.module.css';
import { activeTab, Tabs } from './Tabs';
import { TopBar } from './TopBar';

export interface AppShellProps {
  /**
   * "app": top bar + tabs (signed-in pages). "bare": top bar only (auth, onboarding, privacy).
   * "public": brand only, never the signed-in account (the coming-soon waitlist page).
   */
  variant: 'app' | 'bare' | 'public';
}

export function AppShell({ variant }: AppShellProps) {
  const { pathname } = useLocation();
  const tab = variant === 'app' ? activeTab(pathname) : undefined;

  return (
    <div className={styles.page}>
      <TopBar showSettings={variant === 'app'} showAccount={variant !== 'public'} />
      {variant === 'app' && <Tabs />}
      <main
        className={styles.main}
        {...(tab ? { id: 'app-panel', role: 'tabpanel', 'aria-labelledby': tab.id } : {})}
      >
        <Outlet />
      </main>
      <footer className={styles.footer}>
        <span>{BRAND_NAME} · cookie-free website analytics</span>
        <Link to="/privacy">Privacy</Link>
      </footer>
    </div>
  );
}
