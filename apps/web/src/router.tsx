import { createBrowserRouter, Navigate } from 'react-router';
import { AppShell } from './components/layout/AppShell';
import { LoginPage } from './features/auth/LoginPage';
import { SignupPage } from './features/auth/SignupPage';
import { InstallPage } from './features/install/InstallPage';
import { OnboardingPage } from './features/onboarding/OnboardingPage';
import { SettingsPage } from './features/settings/SettingsPage';
import { SocialPage } from './features/social/SocialPage';
import { WebsitesPage } from './features/websites/WebsitesPage';
import { NotFoundPage } from './pages/NotFoundPage';
import { PrivacyPage } from './pages/PrivacyPage';

/** Routes from BUILD_PROMPT §11. TODO(Phase 1, §11): redirect signed-out users to /login. */
export const router = createBrowserRouter([
  { path: '/', element: <Navigate to="/app/websites" replace /> },
  {
    element: <AppShell variant="bare" />,
    children: [
      { path: '/login', element: <LoginPage /> },
      { path: '/signup', element: <SignupPage /> },
      { path: '/onboarding', element: <OnboardingPage /> },
      { path: '/privacy', element: <PrivacyPage /> },
    ],
  },
  {
    path: '/app',
    element: <AppShell variant="app" />,
    children: [
      { index: true, element: <Navigate to="/app/websites" replace /> },
      { path: 'websites', element: <WebsitesPage /> },
      { path: 'social', element: <SocialPage /> },
      { path: 'install', element: <InstallPage /> },
      { path: 'settings', element: <SettingsPage /> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
  {
    element: <AppShell variant="bare" />,
    children: [{ path: '*', element: <NotFoundPage /> }],
  },
]);
