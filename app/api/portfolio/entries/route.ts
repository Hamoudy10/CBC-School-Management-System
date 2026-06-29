export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { withPermission } from '@/lib/api/withAuth';
import { errorResponse, successResponse, validationErrorResponse } from '@/lib/api/response';
import { validateBody } from '@/lib/api/validation';
import { listEntries, submitEntry, submitEntrySchema } from '@/features/portfolio';

export const GET = withPermission('assessments', 'view', async (request: NextRequest, { user }) => {
  const studentId = request.nextUrl.searchParams.get('studentId') || undefined;
  const learningAreaId = request.nextUrl.searchParams.get('learningAreaId') || undefined;
  const status = request.nextUrl.searchParams.get('status') || undefined;
  try {
    const entries = await listEntries(user.schoolId!, { studentId, learningAreaId, status });
    return successResponse(entries);
  } catch (e) { return errorResponse('Failed to list entries', 500); }
});

export const POST = withPermission('assessments', 'create', async (request, { user }) => {
  const validation = await validateBody(request, submitEntrySchema);
  if (!validation.success) {return validationErrorResponse(validation.errors!);}
  try {
    const entry = await submitEntry(validation.data!, user.schoolId!);
    return successResponse(entry);
  } catch (e) { return errorResponse(e instanceof Error ? e.message : 'Failed', 500); }
});
