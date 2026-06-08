export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { withPermission } from '@/lib/api/withAuth';
import { validateBody } from '@/lib/api/validation';
import { errorResponse, successResponse, validationErrorResponse } from '@/lib/api/response';
import { recordAssessmentSchema, parseVoiceAssessment } from '@/features/voice-mark-entry';

export const POST = withPermission('assessments', 'create', async (request: NextRequest, { user }) => {
  const validation = await validateBody(request, recordAssessmentSchema);
  if (!validation.success) { return validationErrorResponse(validation.errors!); }

  try {
    const result = await parseVoiceAssessment(validation.data!, user);
    return successResponse(result);
  } catch (error) {
    return errorResponse(error instanceof Error ? error.message : 'Failed to process voice entry', 500);
  }
}, 'ai_generation');
