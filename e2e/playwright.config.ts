import { defineConfig, devices } from '@playwright/test';

import { API_URL, WEB_PORT, WEB_URL } from './fixtures/users.js';

/**
 * End-to-end tests against production builds (TESTING.md §1): the built API on a fresh database and a
 * production web build in `.next-e2e` pointed at that API. Build the API first (`pnpm build`); local
 * PostgreSQL and Redis must be running. Ports 3100/4100 keep clear of development servers.
 */
export default defineConfig({
  testDir: './tests',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: { baseURL: WEB_URL, trace: 'retain-on-failure', screenshot: 'only-on-failure' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: [
    {
      command: 'pnpm exec tsx scripts/start-api.ts',
      url: `${API_URL}/health/ready`,
      reuseExistingServer: false,
      timeout: 180_000,
    },
    {
      command: `pnpm --filter @pos/web exec next build && pnpm --filter @pos/web exec next start --port ${String(WEB_PORT)}`,
      env: {
        NEXT_DIST_DIR: '.next-e2e',
        NEXT_PUBLIC_API_URL: API_URL,
        NEXT_TELEMETRY_DISABLED: '1',
      },
      url: `${WEB_URL}/login`,
      reuseExistingServer: false,
      timeout: 300_000,
    },
  ],
});
