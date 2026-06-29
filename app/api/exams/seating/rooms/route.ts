export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { withPermission } from '@/lib/api/withAuth';
import { errorResponse, successResponse, validationErrorResponse } from '@/lib/api/response';
import { validateBody } from '@/lib/api/validation';
import { listExamRooms, createExamRoom, createExamRoomSchema } from '@/features/exam-seating';

export const GET = withPermission('exams', 'view', async (_request: NextRequest, { user }) => {
  try {
    const rooms = await listExamRooms(user.schoolId!);
    return successResponse(rooms);
  } catch (error) {
    return errorResponse(error instanceof Error ? error.message : 'Failed to list rooms', 500);
  }
});

export const POST = withPermission('exams', 'create', async (request: NextRequest, { user }) => {
  const validation = await validateBody(request, createExamRoomSchema);
  if (!validation.success) {return validationErrorResponse(validation.errors!);}
  try {
    const room = await createExamRoom(validation.data!, user.schoolId!);
    return successResponse(room);
  } catch (error) {
    return errorResponse(error instanceof Error ? error.message : 'Failed to create room', 500);
  }
});
