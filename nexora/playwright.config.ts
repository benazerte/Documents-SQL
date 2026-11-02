import { defineConfig, devices } from '@playwright/test';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { randomBytes } from 'node:crypto';

const baseURL = 'http://localhost:3100';
const database = resolve('data', 'e2e', `e2e-${process.pid}-${Date.now()}.sqlite`);
const browserPath =
  process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ||
  (existsSync('/usr/bin/chromium') ? '/usr/bin/chromium' : undefined);

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  workers: 1,
  timeout: 90_000,
  expect: { timeout: 12_000 },
  retries: process.env.CI ? 1 : 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL,
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    ...devices['Desktop Chrome'],
    launchOptions: { executablePath: browserPath, args: ['--no-sandbox'] },
  },
  webServer: {
    command: process.env.NEXORA_E2E_SERVER_COMMAND || 'pnpm start --port 3100',
    url: baseURL,
    reuseExistingServer: false,
    timeout: 120_000,
    env: {
      DATABASE_PATH: database,
      BETTER_AUTH_URL: baseURL,
      BETTER_AUTH_SECRET: randomBytes(48).toString('hex'),
      ALLOW_INSECURE_LOCAL_HTTP: 'true',
      NEXT_TELEMETRY_DISABLED: '1',
    },
  },
});
