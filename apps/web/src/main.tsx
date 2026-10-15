import { QueryClientProvider } from '@tanstack/react-query';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router';
import { ToastProvider } from './components/ui/Toast';
import { queryClient } from './lib/queryClient';
import { createComingSoonRouter, isComingSoonHost } from './comingSoon';
import { router } from './router';
import './styles/tokens.css';
import './styles/global.css';

// traffic.rankbid.click (and any other coming-soon domain) shows only the waitlist page.
const activeRouter = isComingSoonHost(location.hostname) ? createComingSoonRouter() : router;

const root = document.getElementById('root');
if (!root) throw new Error('Missing #root element');

createRoot(root).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <RouterProvider router={activeRouter} />
      </ToastProvider>
    </QueryClientProvider>
  </StrictMode>,
);
