import { afterEach, describe, expect, it, vi } from 'vitest';
import { assertOrigin, errorResponse, readBody } from '../src/server/http';
import { AppError } from '../src/server/domain';

afterEach(() => vi.unstubAllEnvs());

describe('HTTP write protection', () => {
  it('uses the configured canonical origin and rejects absent or foreign origins', () => {
    vi.stubEnv('BETTER_AUTH_URL', 'https://workspace.example');
    expect(() =>
      assertOrigin(
        new Request('http://internal:3000/api/workspaces', {
          headers: { origin: 'https://workspace.example' },
        }),
      ),
    ).not.toThrow();
    for (const origin of [
      '',
      'https://attacker.example',
      'https://workspace.example.attacker.example',
    ]) {
      expect(() =>
        assertOrigin(
          new Request('http://internal:3000/api/workspaces', {
            headers: { origin },
          }),
        ),
      ).toThrow('did not originate');
    }
    expect(() =>
      assertOrigin(
        new Request('http://internal:3000/api/workspaces', {
          headers: { origin: 'https://workspace.example', 'sec-fetch-site': 'cross-site' },
        }),
      ),
    ).toThrow('Cross-site');
  });
  it('rejects unsupported payloads and oversized bodies even without a length header', async () => {
    await expect(
      readBody(
        new Request('http://localhost/api', {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain' },
          body: '{}',
        }),
      ),
    ).rejects.toMatchObject({ status: 415 });
    await expect(
      readBody(
        new Request('http://localhost/api', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: ' '.repeat(1_000_001),
        }),
      ),
    ).rejects.toMatchObject({ status: 413 });
    await expect(
      readBody(
        new Request('http://localhost/api', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: '{broken',
        }),
      ),
    ).rejects.toBeInstanceOf(SyntaxError);
    await expect(
      readBody(
        new Request('http://localhost/api', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type: 'createProject', data: { name: 'Studio' } }),
        }),
      ),
    ).resolves.toMatchObject({ type: 'createProject' });
  });
});

describe('safe API errors', () => {
  it('hides internal errors and disables response caching', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const response = errorResponse(new Error('SQL password/internal path must not escape'));
    expect(response.status).toBe(500);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(await response.text()).not.toContain('SQL password');
    log.mockRestore();
  });
  it('preserves actionable domain errors and authentication status', async () => {
    const response = errorResponse(new AppError('Sign in to continue.', 401));
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: 'Sign in to continue.' });
  });
});
