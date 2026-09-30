import { defineConfig, devices } from '@playwright/test';

/**
 * Browser smoke test against a RUNNING stack (web app + API + seeded DB), e.g. `docker compose up`.
 * Unit and component tests stay in Vitest; this only proves the pieces work together in a real browser.
 *
 *   BASE_URL            web app to test (default: the Docker stack on http://localhost:8080)
 *   PLAYWRIGHT_CHANNEL  optional: use an installed browser (e.g. "chrome") instead of
 *                       downloading Playwright's Chromium with `npx playwright install chromium`
 */
export default defineConfig({
  testDir: './e2e',
  testMatch: '**/*.e2e.ts', // not *.spec.ts, so Vitest never picks these up
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: process.env.BASE_URL ?? 'http://localhost:8080',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        ...(process.env.PLAYWRIGHT_CHANNEL ? { channel: process.env.PLAYWRIGHT_CHANNEL } : {}),
      },
    },
  ],
});
