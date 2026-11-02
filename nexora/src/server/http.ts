import { ZodError } from 'zod';
import { AppError } from './domain';
import { applicationBaseURL } from './origin';

export function json(data: unknown, status = 200) {
  return Response.json(data, { status, headers: { 'Cache-Control': 'no-store' } });
}
export function errorResponse(error: unknown) {
  if (error instanceof ZodError)
    return json(
      {
        error: error.issues
          .map((issue) => `${issue.path.join('.') || 'Input'}: ${issue.message}`)
          .join('; '),
      },
      400,
    );
  if (
    error instanceof AppError ||
    (error instanceof Error && 'status' in error && typeof error.status === 'number')
  ) {
    const status = (error as Error & { status: number }).status;
    return json({ error: error.message }, status >= 400 && status < 600 ? status : 400);
  }
  if (error instanceof SyntaxError) return json({ error: 'Invalid JSON body.' }, 400);
  console.error('NEXORA request failed', error instanceof Error ? error.name : 'UnknownError');
  return json({ error: 'An unexpected error occurred. Please try again.' }, 500);
}
export function assertOrigin(request: Request) {
  const origin = request.headers.get('origin');
  const expected = new URL(applicationBaseURL()).origin;
  if (origin !== expected)
    throw new AppError('This request did not originate from the application.', 403);
  if (request.headers.get('sec-fetch-site') === 'cross-site')
    throw new AppError('Cross-site requests are not allowed.', 403);
}
export async function readBody(request: Request): Promise<unknown> {
  const declared = Number(request.headers.get('content-length') || 0);
  if (declared > 1_000_000) throw new AppError('Request body is too large.', 413);
  if (!request.headers.get('content-type')?.includes('application/json'))
    throw new AppError('Use application/json.', 415);
  const reader = request.body?.getReader();
  if (!reader) throw new AppError('Request body required.');
  const chunks: Uint8Array[] = [];
  let length = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    length += value.byteLength;
    if (length > 1_000_000) {
      await reader.cancel();
      throw new AppError('Request body is too large.', 413);
    }
    chunks.push(value);
  }
  const all = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    all.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return JSON.parse(new TextDecoder().decode(all));
}
