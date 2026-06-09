export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { withPermission } from '@/lib/api/withAuth';
import { validateBody } from '@/lib/api/validation';
import { errorResponse, successResponse, validationErrorResponse } from '@/lib/api/response';
import { generateStudyPlanSchema, generateStudyPlan } from '@/features/study-plan';

export const POST = withPermission('academics', 'create', async (request: NextRequest, { user }) => {
  const validation = await validateBody(request, generateStudyPlanSchema);
  if (!validation.success) { return validationErrorResponse(validation.errors!); }

  try {
    const result = await generateStudyPlan(validation.data!, user);
    return successResponse(result);
  } catch (error) {
    return errorResponse(error instanceof Error ? error.message : 'Failed to generate study plan', 500);
  }
}, 'ai_generation');
