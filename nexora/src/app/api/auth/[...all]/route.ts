import { getAuth } from '@/server/auth';
import { assertOrigin, errorResponse } from '@/server/http';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function GET(request: Request) {
  return getAuth().handler(request);
}
export async function POST(request: Request) {
  try {
    assertOrigin(request);
    const response = await getAuth().handler(request);
    // Better Auth currently emits X-Retry-After; expose the standard header too.
    if (response.status === 429 && response.headers.has('X-Retry-After'))
      response.headers.set('Retry-After', response.headers.get('X-Retry-After')!);
    return response;
  } catch (error) {
    return errorResponse(error);
  }
}
