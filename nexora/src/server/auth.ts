import { betterAuth } from 'better-auth';
import { randomBytes } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { getDb } from './db';

function authConfiguration() {
  const baseURL = process.env.BETTER_AUTH_URL || process.env.AUTH_URL || 'http://localhost:3000';
  const url = new URL(baseURL);
  const production = process.env.NODE_ENV === 'production';
  let secret = process.env.BETTER_AUTH_SECRET || process.env.AUTH_SECRET;
  if (!secret && !production) {
    const path = resolve(
      dirname(process.env.DATABASE_PATH || './data/nexora.sqlite'),
      '.auth-secret',
    );
    mkdirSync(dirname(path), { recursive: true });
    try {
      secret = readFileSync(path, 'utf8').trim();
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
      secret = randomBytes(48).toString('base64url');
      try {
        writeFileSync(path, secret, { mode: 0o600, flag: 'wx' });
      } catch (writeError) {
        if ((writeError as NodeJS.ErrnoException).code !== 'EEXIST') throw writeError;
        secret = readFileSync(path, 'utf8').trim();
      }
    }
  }
  if (!secret || secret.length < 32)
    throw new Error('Configure BETTER_AUTH_SECRET with at least 32 characters.');
  if (production && url.protocol !== 'https:' && process.env.ALLOW_INSECURE_LOCAL_HTTP !== 'true')
    throw new Error(
      'Production BETTER_AUTH_URL must use HTTPS. For isolated local smoke tests only, set ALLOW_INSECURE_LOCAL_HTTP=true.',
    );
  return {
    baseURL,
    secret,
    trustedOrigins: production
      ? [url.origin]
      : [url.origin, 'http://localhost:3000', 'http://127.0.0.1:3000'],
  };
}

function makeAuth() {
  const configuration = authConfiguration();
  return betterAuth({
    appName: 'NEXORA',
    database: getDb(),
    ...configuration,
    telemetry: { enabled: false },
    emailAndPassword: {
      enabled: true,
      minPasswordLength: 12,
      maxPasswordLength: 128,
      requireEmailVerification: false,
    },
    session: { expiresIn: 60 * 60 * 24 * 7, updateAge: 60 * 60 * 24 },
    advanced: {
      useSecureCookies: configuration.baseURL.startsWith('https:'),
      defaultCookieAttributes: { httpOnly: true, sameSite: 'lax' },
      disableOriginCheck: false,
      disableCSRFCheck: false,
      // Request headers cannot prove the direct sender. Only trust forwarded IPs
      // after the operator establishes a private origin and sanitizing proxy.
      ipAddress: {
        ipAddressHeaders: process.env.TRUST_PROXY_HEADERS === 'true' ? ['x-forwarded-for'] : [],
      },
    },
    // Ten registrations allow a small team behind one address to onboard together.
    rateLimit: {
      enabled: true,
      window: 60,
      max: 100,
      customRules: {
        '/sign-in/email': { window: 60, max: 10 },
        '/sign-up/email': { window: 60, max: 10 },
        '/change-password': { window: 60, max: 5 },
      },
    },
  });
}
let auth: ReturnType<typeof makeAuth> | undefined;
export function getAuth() {
  return (auth ??= makeAuth());
}
