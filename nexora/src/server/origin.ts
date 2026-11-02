/**
 * One canonical URL for authentication and CSRF validation.
 *
 * Next's request.url can contain its bind address (0.0.0.0), rather than the
 * browser's localhost address. Never infer a trusted origin from that URL or
 * from client-controlled Host/forwarded headers. Next sets PORT to the actual
 * listening port, including its development fallback when 3000 is occupied.
 */
export function applicationBaseURL(): string {
  const configured = process.env.BETTER_AUTH_URL || process.env.AUTH_URL;
  if (configured) return configured;
  const port = Number(process.env.PORT || '3000');
  if (!Number.isInteger(port) || port < 1 || port > 65535)
    throw new Error('PORT must be an integer between 1 and 65535.');
  return `http://localhost:${port}`;
}
