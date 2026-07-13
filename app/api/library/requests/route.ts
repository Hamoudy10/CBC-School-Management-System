export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { withPermission } from '@/lib/api/withAuth';
import { errorResponse, successResponse, validationErrorResponse } from '@/lib/api/response';
import { validateBody } from '@/lib/api/validation';
import { listBookRequests, createBookRequest, reviewBookRequest, createBookRequestSchema } from '@/features/library';

export const GET = withPermission('library', 'view', async (_request, { user }) => {
  try { return successResponse(await listBookRequests(user.schoolId!)); }
  catch (e) { return errorResponse('Failed to list requests', 500); }
});

export const POST = withPermission('library', 'create', async (request, { user }) => {
  const v = await validateBody(request, createBookRequestSchema);
  if (!v.success) {return validationErrorResponse(v.errors!);}
  try { return successResponse(await createBookRequest(v.data!, user.schoolId!, user.id)); }
  catch (e) { return errorResponse(e instanceof Error ? e.message : 'Failed', 500); }
});

export const PATCH = withPermission('library', 'update', async (request, { user }) => {
  const body = await request.json();
  if (!body.requestId || !body.status) {return errorResponse('requestId and status required', 400);}
  try { await reviewBookRequest(body.requestId, body.status, user.schoolId!, user.id); return successResponse({ reviewed: true }); }
  catch (e) { return errorResponse(e instanceof Error ? e.message : 'Failed', 500); }
});
