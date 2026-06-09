export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { withPermission } from '@/lib/api/withAuth';
import { errorResponse, successResponse } from '@/lib/api/response';
import { getSeatingPlan } from '@/features/exam-seating';

export const GET = withPermission('exams', 'view', async (_request: NextRequest, { user, params }) => {
  try {
    const plan = await getSeatingPlan(params.id, user.schoolId!);
    if (!plan) return errorResponse('Seating plan not found', 404);
    return successResponse(plan);
  } catch (error) {
    return errorResponse(error instanceof Error ? error.message : 'Failed to get seating plan', 500);
  }
});
