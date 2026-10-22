import { defineConfig } from '@playwright/test';

// End-to-end tests of the Electron app (see e2e/). Every test gets its own empty data folder (test database),
// and all requests to Tenrai/AniList are answered with fixtures, so tests neither touch real data nor the internet.
export default defineConfig({
  testDir: './e2e',
  // One Electron instance at a time: all instances share the Next dev server on port 9002.
  workers: 1,
  fullyParallel: false,
  timeout: 90_000,
  expect: { timeout: 15_000 },
  retries: process.env.CI ? 1 : 0,
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'playwright-report' }]],
  outputDir: 'test-results',
  globalSetup: './e2e/global-setup.ts',
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:9002',
    // Uses an already running `npm run dev` / `npm run electron:dev` instead of starting a second one.
    reuseExistingServer: true,
    timeout: 180_000,
  },
});
