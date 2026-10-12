import { Outlet, useLocation } from 'react-router';
import styles from './AppShell.module.css';
import { activeTab, Tabs } from './Tabs';
import { TopBar } from './TopBar';

export interface AppShellProps {
  /** "app": top bar + tabs (signed-in pages). "bare": top bar only (auth, onboarding, privacy). */
  variant: 'app' | 'bare';
}

export function AppShell({ variant }: AppShellProps) {
  const { pathname } = useLocation();
  const tab = variant === 'app' ? activeTab(pathname) : undefined;

  return (
    <div className={styles.page}>
      <TopBar showSettings={variant === 'app'} />
      {variant === 'app' && <Tabs />}
      <main
        className={styles.main}
        {...(tab ? { id: 'app-panel', role: 'tabpanel', 'aria-labelledby': tab.id } : {})}
      >
        <Outlet />
      </main>
    </div>
  );
}
