import { afterEach, describe, expect, it, vi } from 'vitest';
import { applicationBaseURL } from '../src/server/origin';
import { assertOrigin } from '../src/server/http';

afterEach(() => vi.unstubAllEnvs());
function localEnvironment(port = '3000') {
  vi.stubEnv('BETTER_AUTH_URL', '');
  vi.stubEnv('AUTH_URL', '');
  vi.stubEnv('PORT', port);
}
function request(internal: string, origin: string, extra: Record<string, string> = {}) {
  return new Request(`${internal}/api/auth/sign-up/email`, { headers: { origin, ...extra } });
}

describe('fresh local development origin regression', () => {
  it('accepts localhost signup when Next exposes its internal bind address', () => {
    localEnvironment();
    expect(applicationBaseURL()).toBe('http://localhost:3000');
    expect(() =>
      assertOrigin(request('http://0.0.0.0:3000', 'http://localhost:3000')),
    ).not.toThrow();
  });
  it('uses the actual Next listening port for both auth and origin checks', () => {
    localEnvironment('3102');
    expect(applicationBaseURL()).toBe('http://localhost:3102');
    expect(() =>
      assertOrigin(request('http://0.0.0.0:3102', 'http://localhost:3102')),
    ).not.toThrow();
    expect(() => assertOrigin(request('http://0.0.0.0:3102', 'http://localhost:3000'))).toThrow();
  });
  it('defaults to port 3000 when no environment configuration exists', () => {
    localEnvironment('');
    expect(applicationBaseURL()).toBe('http://localhost:3000');
  });
  it('never trusts an arbitrary Host, forwarded host, or foreign origin', () => {
    localEnvironment();
    const forged = request('http://attacker.example', 'http://attacker.example', {
      host: 'attacker.example',
      'x-forwarded-host': 'localhost:3000',
      'x-forwarded-proto': 'http',
    });
    expect(() => assertOrigin(forged)).toThrow();
    expect(() =>
      assertOrigin(request('http://0.0.0.0:3000', 'https://localhost:3000.attacker.example')),
    ).toThrow();
    expect(() =>
      assertOrigin(
        request('http://0.0.0.0:3000', 'http://localhost:3000', { 'sec-fetch-site': 'cross-site' }),
      ),
    ).toThrow('Cross-site');
  });
  it('keeps explicit canonical production origins authoritative', () => {
    localEnvironment('3102');
    vi.stubEnv('BETTER_AUTH_URL', 'https://work.example');
    expect(applicationBaseURL()).toBe('https://work.example');
    expect(() =>
      assertOrigin(request('http://0.0.0.0:3102', 'https://work.example')),
    ).not.toThrow();
    expect(() => assertOrigin(request('http://0.0.0.0:3102', 'http://localhost:3102'))).toThrow();
    vi.stubEnv('BETTER_AUTH_URL', '');
    vi.stubEnv('AUTH_URL', 'https://alias.example');
    expect(applicationBaseURL()).toBe('https://alias.example');
  });
  it.each(['0', '65536', 'NaN', '3000/evil', '-1'])('rejects invalid fallback port %s', (port) => {
    localEnvironment(port);
    expect(() => applicationBaseURL()).toThrow('PORT');
  });
});
