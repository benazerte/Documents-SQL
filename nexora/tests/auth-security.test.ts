import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomBytes } from 'node:crypto';
import { getAuth } from '../src/server/auth';
import { getDb } from '../src/server/db';
import { POST as authPOST } from '../src/app/api/auth/[...all]/route';

const environmentKeys = [
  'NODE_ENV',
  'DATABASE_PATH',
  'BETTER_AUTH_URL',
  'AUTH_URL',
  'BETTER_AUTH_SECRET',
  'AUTH_SECRET',
  'ALLOW_INSECURE_LOCAL_HTTP',
  'TRUST_PROXY_HEADERS',
] as const;
let original: Record<string, string | undefined>;
let directory: string;
beforeAll(() => {
  original = Object.fromEntries(environmentKeys.map((key) => [key, process.env[key]]));
  directory = mkdtempSync(join(tmpdir(), 'nexora-auth-security-'));
  Object.assign(process.env, { NODE_ENV: 'production' });
  process.env.DATABASE_PATH = join(directory, 'auth.sqlite');
  process.env.BETTER_AUTH_URL = 'http://localhost:3000';
  for (const key of [
    'BETTER_AUTH_SECRET',
    'AUTH_SECRET',
    'ALLOW_INSECURE_LOCAL_HTTP',
    'TRUST_PROXY_HEADERS',
  ])
    delete process.env[key];
});
afterAll(() => {
  getDb().close();
  for (const key of environmentKeys) {
    if (original[key] === undefined) Reflect.deleteProperty(process.env, key);
    else Object.assign(process.env, { [key]: original[key] });
  }
  rmSync(directory, { recursive: true, force: true });
});

function authRequest(
  path: string,
  body: Record<string, unknown>,
  forwardedIp = '198.51.100.10',
  origin = 'http://localhost:3000',
) {
  return authPOST(
    new Request(`http://localhost:3000/api/auth/${path}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin, 'x-forwarded-for': forwardedIp },
      body: JSON.stringify(body),
    }),
  );
}

describe('production authentication safeguards', () => {
  it('fails closed for absent or weak production secrets and plaintext production URL', () => {
    expect(() => getAuth()).toThrow('BETTER_AUTH_SECRET');
    process.env.BETTER_AUTH_SECRET = 'too-short';
    expect(() => getAuth()).toThrow('at least 32');
    process.env.BETTER_AUTH_SECRET = randomBytes(48).toString('base64url');
    expect(() => getAuth()).toThrow('must use HTTPS');
    // The explicit, isolated local smoke-test exception leaves rate limits enabled.
    process.env.ALLOW_INSECURE_LOCAL_HTTP = 'true';
    expect(() => getAuth()).not.toThrow();
  });
  it('rejects cross-origin authentication mutations', async () => {
    const response = await authRequest(
      'sign-up/email',
      {
        name: 'Security check',
        email: 'security@example.test',
        password: randomBytes(24).toString('base64url'),
      },
      '198.51.100.10',
      'https://untrusted.example',
    );
    expect(response.status).toBe(403);
    expect(getDb().prepare('SELECT COUNT(*) AS count FROM user').get()).toEqual({ count: 0 });
  });
  it('enforces signup throttling and cannot be bypassed with forged forwarded headers', async () => {
    // Invalid credentials avoid creating fixtures while exercising the real handler.
    // An origin-rejected request may already consume a quota entry; count all replies.
    let throttled = false,
      permitted = 0;
    for (let attempt = 0; attempt < 11; attempt++) {
      const response = await authRequest(
        'sign-up/email',
        { name: 'Security check', email: `rate-${attempt}@example.test`, password: 'short' },
        `198.51.100.${attempt + 1}`,
      );
      if (response.status === 429) {
        throttled = true;
        expect(Number(response.headers.get('retry-after'))).toBeGreaterThan(0);
      } else {
        expect(response.status).toBe(400);
        permitted++;
      }
    }
    expect(throttled).toBe(true);
    expect(permitted).toBeLessThanOrEqual(10);
    const response = await authRequest(
      'sign-up/email',
      { name: 'Security check', email: 'spoofed@example.test', password: 'short' },
      '203.0.113.200',
    );
    expect(response.status).toBe(429);
    expect(getDb().prepare('SELECT COUNT(*) AS count FROM user').get()).toEqual({ count: 0 });
  });
  it('also throttles sign-in attempts through the production handler', async () => {
    for (let attempt = 0; attempt < 10; attempt++) {
      const response = await authRequest(
        'sign-in/email',
        { email: 'not-an-email', password: 'short' },
        `203.0.113.${attempt + 1}`,
      );
      expect(response.status).toBe(400);
    }
    const response = await authRequest(
      'sign-in/email',
      { email: 'not-an-email', password: 'short' },
      '203.0.113.222',
    );
    expect(response.status).toBe(429);
    expect(Number(response.headers.get('retry-after'))).toBeGreaterThan(0);
  });
});
