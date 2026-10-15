import { createBrowserRouter } from 'react-router';
import { AppShell } from './components/layout/AppShell';
import { WaitlistPage } from './features/waitlist/WaitlistPage';
import { PrivacyPage } from './pages/PrivacyPage';

/**
 * Domains that show only the "opening soon" waitlist page (plus /privacy) instead of the app.
 * Set VITE_COMING_SOON_HOSTS (comma-separated) to change the list; when unset it is
 * traffic.rankbid.click. Every other domain, such as trackerlens-web.vercel.app, gets the full app.
 */
const COMING_SOON_HOSTS = (import.meta.env['VITE_COMING_SOON_HOSTS'] ?? 'traffic.rankbid.click')
  .split(',')
  .map((h: string) =>
    h
      .trim()
      .toLowerCase()
      .replace(/^www\./, ''),
  )
  .filter(Boolean);

export function isComingSoonHost(hostname: string): boolean {
  return COMING_SOON_HOSTS.includes(hostname.toLowerCase().replace(/^www\./, ''));
}

/** Every address on a coming-soon domain shows the waitlist page, except the privacy page. */
export function createComingSoonRouter() {
  return createBrowserRouter([
    {
      element: <AppShell variant="bare" />,
      children: [{ path: '/privacy', element: <PrivacyPage /> }],
    },
    {
      element: <AppShell variant="public" />,
      children: [{ path: '*', element: <WaitlistPage /> }],
    },
  ]);
}
