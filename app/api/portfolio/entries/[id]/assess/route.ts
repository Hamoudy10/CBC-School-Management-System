export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { withPermission } from '@/lib/api/withAuth';
import { errorResponse, successResponse, validationErrorResponse } from '@/lib/api/response';
import { validateBody } from '@/lib/api/validation';
import { assessEntry, assessEntrySchema } from '@/features/portfolio';

export const PATCH = withPermission('assessments', 'create', async (request: NextRequest, { user, params }) => {
  const validation = await validateBody(request, assessEntrySchema);
  if (!validation.success) {return validationErrorResponse(validation.errors!);}
  try {
    const entry = await assessEntry(params.id, validation.data!, user.id, user.schoolId!);
    return successResponse(entry);
  } catch (e) { return errorResponse(e instanceof Error ? e.message : 'Failed', 500); }
});
