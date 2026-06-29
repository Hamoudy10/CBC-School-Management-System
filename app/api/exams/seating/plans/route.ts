export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { withPermission } from '@/lib/api/withAuth';
import { errorResponse, successResponse, validationErrorResponse } from '@/lib/api/response';
import { validateBody } from '@/lib/api/validation';
import { generateSeatingPlan, generateSeatingPlanSchema } from '@/features/exam-seating';

export const POST = withPermission('exams', 'create', async (request: NextRequest, { user }) => {
  const validation = await validateBody(request, generateSeatingPlanSchema);
  if (!validation.success) {return validationErrorResponse(validation.errors!);}
  try {
    const chart = await generateSeatingPlan(validation.data!, user.schoolId!);
    return successResponse(chart);
  } catch (error) {
    return errorResponse(error instanceof Error ? error.message : 'Failed to generate seating plan', 500);
  }
});
