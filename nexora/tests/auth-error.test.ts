import { describe, expect, it } from 'vitest';
import { authenticationErrorMessage } from '../src/lib/auth-error';

describe('authentication error messages', () => {
  it('preserves public errors from the NEXORA wrapper and Better Auth', () => {
    expect(authenticationErrorMessage({ status: 400, error: 'Enter your full name.' })).toBe(
      'Enter your full name.',
    );
    expect(
      authenticationErrorMessage({
        status: 401,
        code: 'INVALID_EMAIL_OR_PASSWORD',
        message: 'Invalid email or password',
      }),
    ).toBe('Invalid email or password');
    expect(authenticationErrorMessage({ error: 'This account needs attention.' })).toBe(
      'This account needs attention.',
    );
    expect(
      authenticationErrorMessage({ message: '', error: 'The request could not be completed.' }),
    ).toBe('The request could not be completed.');
  });
  it('explains origin configuration errors instead of discarding the wrapper error', () => {
    for (const value of [
      { status: 403, error: 'This request did not originate from the application.' },
      { status: 403, message: 'Invalid origin', code: 'INVALID_ORIGIN' },
      { status: 403, error: 'Cross-site requests are not allowed.' },
      { code: 'MISSING_OR_NULL_ORIGIN' },
    ]) {
      const message = authenticationErrorMessage(value);
      expect(message).toContain('BETTER_AUTH_URL');
      expect(message).toContain('browser address');
      expect(message).not.toContain('Check your details');
    }
  });
  it('does not mislabel every permission error as an origin failure', () => {
    expect(authenticationErrorMessage({ status: 403, message: 'Verify your email address.' })).toBe(
      'Verify your email address.',
    );
  });
  it('gives a useful retry instruction for throttled attempts', () => {
    expect(authenticationErrorMessage({ status: 429 })).toContain('wait a minute');
    expect(
      authenticationErrorMessage({ code: 'TOO_MANY_REQUESTS', message: 'Generic error' }),
    ).toContain('wait a minute');
  });
  it('provides a code fallback without inventing a server message', () => {
    expect(authenticationErrorMessage({ status: 401, code: 'INVALID_EMAIL_OR_PASSWORD' })).toBe(
      'The email address or password is incorrect.',
    );
    expect(authenticationErrorMessage({ status: 400, code: 'PASSWORD_TOO_SHORT' })).toContain('12');
  });
  it('hides server diagnostics and does not stringify nested errors or stack traces', () => {
    expect(
      authenticationErrorMessage({ status: 500, message: 'SQL password=private /internal/path' }),
    ).not.toContain('private');
    expect(
      authenticationErrorMessage({ status: 500, error: 'Native binding at /internal/path' }),
    ).not.toContain('/internal/path');
    expect(authenticationErrorMessage({ error: { stack: 'private stack' } })).not.toContain(
      'private',
    );
    expect(
      authenticationErrorMessage({ message: 'Error: private\n    at secret/path.ts:10' }),
    ).not.toContain('private');
  });
  it('normalizes connection errors and malformed responses safely', () => {
    expect(authenticationErrorMessage(new TypeError('Failed to fetch'))).toContain('connection');
    for (const value of [
      null,
      undefined,
      123,
      'raw exception',
      [],
      { stack: 'private' },
      { message: 'x'.repeat(501) },
    ])
      expect(authenticationErrorMessage(value)).toBe(
        'Unable to authenticate. Check your details and try again.',
      );
  });
});
