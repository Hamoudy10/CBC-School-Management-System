export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { withPermission } from '@/lib/api/withAuth';
import { validateBody } from '@/lib/api/validation';
import { errorResponse, successResponse, validationErrorResponse } from '@/lib/api/response';
import { generateExamSchema, generateExam } from '@/features/exam-generator';

export const POST = withPermission('assessments', 'create', async (request: NextRequest, { user }) => {
  const validation = await validateBody(request, generateExamSchema);
  if (!validation.success) { return validationErrorResponse(validation.errors!); }

  try {
    const result = await generateExam(validation.data!, user);
    return successResponse(result);
  } catch (error) {
    return errorResponse(error instanceof Error ? error.message : 'Failed to generate exam paper', 500);
  }
}, 'ai_generation');
