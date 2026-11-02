import { chromium } from '@playwright/test';
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { randomBytes } from 'node:crypto';

const origin = 'http://localhost:3100';
const env = {
  ...process.env,
  DATABASE_PATH: resolve('data', `visual-review-${Date.now()}.sqlite`),
  BETTER_AUTH_URL: origin,
  BETTER_AUTH_SECRET: randomBytes(48).toString('hex'),
  ALLOW_INSECURE_LOCAL_HTTP: 'true',
  NEXT_TELEMETRY_DISABLED: '1',
};
const child = spawn('pnpm', ['start', '--port', '3100'], {
  env,
  stdio: ['ignore', 'pipe', 'pipe'],
  detached: process.platform !== 'win32',
});
let serverOutput = '';
child.stdout.on('data', (d) => {
  serverOutput += d.toString();
});
child.stderr.on('data', (d) => {
  serverOutput += d.toString();
});
let browser;
try {
  const deadline = Date.now() + 60_000;
  let ready = false;
  while (Date.now() < deadline) {
    try {
      if ((await fetch(origin)).ok) {
        ready = true;
        break;
      }
    } catch {
      /* startup */
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  if (!ready) throw new Error(`Review server not ready: ${serverOutput}`);
  browser = await chromium.launch({
    executablePath:
      process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ||
      (existsSync('/usr/bin/chromium') ? '/usr/bin/chromium' : undefined),
    args: ['--no-sandbox'],
  });
  const context = await browser.newContext({
    baseURL: origin,
    viewport: { width: 1536, height: 1100 },
    deviceScaleFactor: 1,
  });
  const credentials = {
    name: 'Alex Morgan',
    email: `visual-${Date.now()}@example.test`,
    password: randomBytes(24).toString('base64url'),
  };
  const auth = await context.request.post('/api/auth/sign-up/email', {
    headers: { Origin: origin },
    data: credentials,
  });
  if (!auth.ok()) throw new Error(`Review signup failed (${auth.status()}): ${await auth.text()}`);
  const created = await context.request.post('/api/workspaces', {
    headers: { Origin: origin },
    data: { name: 'Sample · Meridian Studio', demo: true },
  });
  if (!created.ok())
    throw new Error(`Review workspace failed (${created.status()}): ${await created.text()}`);
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  const out = resolve('test-results', 'screenshots');
  mkdirSync(out, { recursive: true });
  await page.goto(origin);
  await page.getByRole('heading', { name: /Good (morning|afternoon|evening)/ }).waitFor();
  await page.screenshot({ path: resolve(out, 'overview-desktop.png'), fullPage: true });
  await page.getByRole('button', { name: 'Visual workspace', exact: true }).click();
  await page.locator('.react-flow__node').first().waitFor();
  await page.waitForTimeout(600);
  await page.screenshot({ path: resolve(out, 'graph-desktop.png'), fullPage: true });
  await page.getByRole('button', { name: 'Use light theme', exact: true }).click();
  await page.waitForTimeout(250);
  const lightStyles = await page.evaluate(() => {
    const root = getComputedStyle(document.documentElement);
    const nav = document.querySelector('nav .nav-item');
    return {
      theme: document.documentElement.dataset.theme,
      muted: root.getPropertyValue('--muted'),
      text: root.getPropertyValue('--text'),
      navColor: nav ? getComputedStyle(nav).color : null,
    };
  });
  await page.screenshot({ path: resolve(out, 'graph-light.png'), fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${origin}/?view=overview`);
  await page.getByRole('heading', { name: /Good (morning|afternoon|evening)/ }).waitFor();
  await page.screenshot({ path: resolve(out, 'overview-mobile.png'), fullPage: true });
  console.log(JSON.stringify({ screenshots: out, browserErrors: errors, lightStyles }, null, 2));
  if (errors.length) process.exitCode = 1;
} finally {
  await browser?.close();
  if (child.pid) {
    try {
      if (process.platform === 'win32') child.kill('SIGTERM');
      else process.kill(-child.pid, 'SIGTERM');
    } catch (error) {
      if (error.code !== 'ESRCH') throw error;
    }
  }
}
