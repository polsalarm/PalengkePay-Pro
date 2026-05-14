import { defineConfig, devices } from '@playwright/test';

const qaPort = Number(process.env.PLAYWRIGHT_PORT ?? 5173);
const qaBaseUrl = `http://127.0.0.1:${qaPort}`;

export default defineConfig({
  testDir: './tests',
  outputDir: './test-results',
  workers: 1,
  reporter: [['list'], ['html', { open: 'never' }]],
  expect: {
    timeout: 15_000,
  },
  use: {
    baseURL: qaBaseUrl,
    trace: 'retain-on-failure',
    serviceWorkers: 'block',
  },
  webServer: {
    command: `node scripts/serve-dist.mjs --host 127.0.0.1 --port ${qaPort}`,
    url: qaBaseUrl,
    reuseExistingServer: false,
    timeout: 120_000,
  },
  projects: [
    {
      name: 'desktop',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 1000 } },
    },
    {
      name: 'mobile',
      use: { ...devices['Pixel 5'], viewport: { width: 390, height: 844 } },
    },
  ],
});
