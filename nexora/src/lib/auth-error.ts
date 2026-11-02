const fallback = 'Unable to authenticate. Check your details and try again.';
const originHint =
  'This application address is not authorized. Open the configured application address, or update BETTER_AUTH_URL to match your browser address and restart the server.';

const messagesByCode: Record<string, string> = {
  INVALID_EMAIL_OR_PASSWORD: 'The email address or password is incorrect.',
  INVALID_EMAIL: 'Enter a valid email address.',
  PASSWORD_TOO_SHORT: 'Use a password with at least 12 characters.',
  PASSWORD_TOO_LONG: 'Use a password with no more than 128 characters.',
  USER_ALREADY_EXISTS: 'An account with this email address already exists. Sign in instead.',
  USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL:
    'An account with this email address already exists. Sign in instead.',
};

/** Normalize public API errors without rendering error objects, stacks, or server failures. */
export function authenticationErrorMessage(error: unknown): string {
  if (!error || typeof error !== 'object' || Array.isArray(error)) return fallback;
  const details = error as Record<string, unknown>;
  const status = typeof details.status === 'number' ? details.status : undefined;
  const code = typeof details.code === 'string' ? details.code : '';
  if (status === 429 || code === 'TOO_MANY_REQUESTS')
    return 'Too many attempts. Please wait a minute before trying again.';
  if (status !== undefined && status >= 500)
    return 'The application could not complete authentication. Please try again or check the server terminal for details.';

  // Better Auth uses { message, code }; NEXORA's origin guard uses { error }.
  const candidate =
    typeof details.message === 'string' && details.message.trim()
      ? details.message
      : typeof details.error === 'string'
        ? details.error
        : '';
  const message = candidate.trim();
  if (
    code === 'INVALID_ORIGIN' ||
    code === 'MISSING_OR_NULL_ORIGIN' ||
    code === 'CROSS_SITE_NAVIGATION_LOGIN_BLOCKED' ||
    (status === 403 && /\borigin\b|did not originate|cross-site/i.test(message))
  )
    return originHint;
  if (
    message &&
    /^(failed to fetch|fetch failed|networkerror|network request failed)/i.test(message)
  )
    return 'Unable to reach the application. Check your connection and try again.';
  // Never flatten a structured error/stack into the form or display a stack trace.
  if (message && message.length <= 500 && !/[\r\n]/.test(message)) return message;
  if (messagesByCode[code]) return messagesByCode[code];
  if (status === 403)
    return 'Access denied. Check the application address and your account access.';
  return fallback;
}
