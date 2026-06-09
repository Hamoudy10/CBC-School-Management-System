export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { withPermission } from '@/lib/api/withAuth';
import { errorResponse, successResponse } from '@/lib/api/response';
import { deleteExamRoom } from '@/features/exam-seating';

export const DELETE = withPermission('exams', 'delete', async (_request: NextRequest, { user, params }) => {
  try {
    await deleteExamRoom(params.id, user.schoolId!);
    return successResponse({ deleted: true });
  } catch (error) {
    return errorResponse(error instanceof Error ? error.message : 'Failed to delete room', 500);
  }
});
