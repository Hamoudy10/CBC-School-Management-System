export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { withPermission } from '@/lib/api/withAuth';
import { errorResponse, successResponse, validationErrorResponse } from '@/lib/api/response';
import { validateBody } from '@/lib/api/validation';
import { listCategories, createCategory, createCategorySchema } from '@/features/library';

export const GET = withPermission('library', 'view', async (_request, { user }) => {
  try { return successResponse(await listCategories(user.schoolId!)); }
  catch (e) { return errorResponse('Failed to list categories', 500); }
});

export const POST = withPermission('library', 'create', async (request, { user }) => {
  const v = await validateBody(request, createCategorySchema);
  if (!v.success) {return validationErrorResponse(v.errors!);}
  try { return successResponse(await createCategory(v.data!, user.schoolId!)); }
  catch (e) { return errorResponse(e instanceof Error ? e.message : 'Failed', 500); }
});
