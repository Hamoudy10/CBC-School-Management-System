export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { withPermission } from '@/lib/api/withAuth';
import { errorResponse, successResponse } from '@/lib/api/response';
import { deleteCategory } from '@/features/library';

export const DELETE = withPermission('library', 'delete', async (request, { user, params }) => {
  try { await deleteCategory(params.id, user.schoolId!); return successResponse({ deleted: true }); }
  catch (e) { return errorResponse(e instanceof Error ? e.message : 'Failed', 500); }
});
