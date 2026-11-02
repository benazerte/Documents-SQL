import { createWorkspace, getUser, listWorkspaces } from '@/server/core';
import { assertOrigin, errorResponse, json, readBody } from '@/server/http';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export async function GET(request: Request) {
  try {
    const user = await getUser(request);
    return json({ user, workspaces: listWorkspaces(user.id) });
  } catch (error) {
    return errorResponse(error);
  }
}
export async function POST(request: Request) {
  try {
    assertOrigin(request);
    const user = await getUser(request);
    return json(createWorkspace(user.id, await readBody(request)), 201);
  } catch (error) {
    return errorResponse(error);
  }
}
