import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright configuration for end-to-end RSVP flow tests.
 *
 * Prerequisites before running tests:
 *   1. Build the app:  npx opennextjs-cloudflare build
 *   2. Create a .dev.vars file at the repo root with at minimum:
 *        AUTH_SECRET=<any-string>
 *   3. Run: npm run test:e2e
 *
 * The wrangler dev server is started by globalSetup (not via webServer here).
 * This avoids the SQLITE_CANTOPEN Linux sandbox issue: workerd must create the
 * SQLite file on first boot before any wrangler d1 CLI commands seed into it.
 */

export default defineConfig({
  testDir: './tests/e2e',

  // Tests share local D1 state — run sequentially to avoid conflicts.
  fullyParallel: false,
  workers: 1,

  // Fail the build on CI if you accidentally left test.only in a test file.
  forbidOnly: !!process.env.CI,

  // Retry once on CI to guard against transient timing issues.
  retries: process.env.CI ? 1 : 0,

  reporter: process.env.CI
    ? [
        ['github'],
        ['html', { open: 'never' }],
        ['junit', { outputFile: 'test-reports/e2e-junit.xml' }],
      ]
    : [['list'], ['html', { open: 'on-failure' }]],

  use: {
    baseURL: 'http://localhost:8787',

    // Capture Playwright traces on the first retry to help debug CI failures.
    trace: 'on-first-retry',

    // Capture screenshots automatically on test failure.
    screenshot: 'only-on-failure',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  globalSetup: './tests/e2e/global-setup.ts',
  globalTeardown: './tests/e2e/global-teardown.ts',
});
