import { getSnapshot, requireContext } from '@/server/core';
import { errorResponse, json } from '@/server/http';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    return json(getSnapshot(await requireContext(request, (await params).id)));
  } catch (error) {
    return errorResponse(error);
  }
}
