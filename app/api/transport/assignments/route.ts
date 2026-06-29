export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { withPermission } from '@/lib/api/withAuth';
import { errorResponse, successResponse, validationErrorResponse } from '@/lib/api/response';
import { validateBody } from '@/lib/api/validation';
import { listAssignments, assignStudent, assignStudentSchema } from '@/features/transport';

export const GET = withPermission('timetable', 'view', async (_request, { user }) => {
  try { return successResponse(await listAssignments(user.schoolId!)); }
  catch (e) { return errorResponse('Failed to list assignments', 500); }
});

export const POST = withPermission('timetable', 'create', async (request, { user }) => {
  const v = await validateBody(request, assignStudentSchema);
  if (!v.success) {return validationErrorResponse(v.errors!);}
  try { return successResponse(await assignStudent(v.data!, user.schoolId!)); }
  catch (e) { return errorResponse(e instanceof Error ? e.message : 'Failed', 500); }
});
