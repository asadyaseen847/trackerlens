import { defineConfig, devices } from '@playwright/test';

// TODO(Phase 2, §15): webServer entries for the API and a static server for examples/test-site.
export default defineConfig({
  testDir: '.',
  fullyParallel: false,
  forbidOnly: !!process.env['CI'],
  retries: process.env['CI'] ? 1 : 0,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
