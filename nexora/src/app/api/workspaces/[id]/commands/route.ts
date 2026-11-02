import { executeCommand, requireContext } from '@/server/core';
import { assertOrigin, errorResponse, json, readBody } from '@/server/http';
import type { Command } from '@/lib/types';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    assertOrigin(request);
    const ctx = await requireContext(request, (await params).id);
    return json(executeCommand(ctx, (await readBody(request)) as Command));
  } catch (error) {
    return errorResponse(error);
  }
}
