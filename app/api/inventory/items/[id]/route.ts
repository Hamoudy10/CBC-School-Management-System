export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { withPermission } from '@/lib/api/withAuth';
import { errorResponse, successResponse, validationErrorResponse } from '@/lib/api/response';
import { validateBody } from '@/lib/api/validation';
import { updateInventoryItem, deleteInventoryItem, updateInventoryItemSchema } from '@/features/library';

export const PATCH = withPermission('library', 'update', async (request, { user, params }) => {
  const v = await validateBody(request, updateInventoryItemSchema);
  if (!v.success) {return validationErrorResponse(v.errors!);}
  try { return successResponse(await updateInventoryItem(params.id, v.data!, user.schoolId!)); }
  catch (e) { return errorResponse(e instanceof Error ? e.message : 'Failed', 500); }
});

export const DELETE = withPermission('library', 'delete', async (request, { user, params }) => {
  try { await deleteInventoryItem(params.id, user.schoolId!); return successResponse({ deleted: true }); }
  catch (e) { return errorResponse(e instanceof Error ? e.message : 'Failed', 500); }
});
