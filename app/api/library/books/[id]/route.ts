export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { withPermission } from '@/lib/api/withAuth';
import { errorResponse, successResponse, validationErrorResponse } from '@/lib/api/response';
import { validateBody } from '@/lib/api/validation';
import { getBook, updateBook, updateBookSchema } from '@/features/library';

export const GET = withPermission('library', 'view', async (request, { user, params }) => {
  try { return successResponse(await getBook(params.id, user.schoolId!)); }
  catch (e) { return errorResponse('Failed to get book', 500); }
});

export const PATCH = withPermission('library', 'update', async (request, { user, params }) => {
  const v = await validateBody(request, updateBookSchema);
  if (!v.success) {return validationErrorResponse(v.errors!);}
  try { return successResponse(await updateBook(params.id, v.data!, user.schoolId!)); }
  catch (e) { return errorResponse(e instanceof Error ? e.message : 'Failed', 500); }
});
