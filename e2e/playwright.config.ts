import { defineConfig, devices } from '@playwright/test';

/**
 * End-to-end smoke test (BUILD_PROMPT §15): tracker → collect → database → dashboard.
 * Runs everything locally on its own ports, with the real API on an in-memory Postgres, so it
 * needs no Supabase. Run with `npm run test:e2e` (first time: `npx playwright install chromium`).
 */
const API = 4100;
const WEB = 5174;
const SITE = 4200;

export default defineConfig({
  testDir: '.',
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env['CI'],
  retries: process.env['CI'] ? 1 : 0,
  reporter: 'list',
  timeout: 60_000,
  use: {
    baseURL: `http://localhost:${WEB}`,
    trace: 'on-first-retry',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: [
    {
      command: 'npx tsx scripts/demo-server.ts',
      cwd: '..',
      url: `http://localhost:${API}/api/health`,
      env: { PORT: String(API), DEMO_SEED: '0', NODE_ENV: 'test' },
      reuseExistingServer: false,
      timeout: 120_000,
    },
    {
      command: `npm run build:tracker && npm run dev -w @audience/web -- --port ${WEB} --strictPort`,
      cwd: '..',
      url: `http://localhost:${WEB}/js/script.js`,
      env: { API_PROXY_TARGET: `http://localhost:${API}` },
      reuseExistingServer: false,
      timeout: 120_000,
    },
    {
      command: 'node e2e/testSiteServer.mjs',
      cwd: '..',
      url: `http://localhost:${SITE}/`,
      env: { PORT: String(SITE) },
      reuseExistingServer: false,
    },
  ],
});

export const PORTS = { API, WEB, SITE };
