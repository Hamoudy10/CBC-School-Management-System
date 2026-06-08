export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { withPermission } from '@/lib/api/withAuth';
import { validateBody } from '@/lib/api/validation';
import { errorResponse, successResponse, validationErrorResponse } from '@/lib/api/response';
import { z } from 'zod';

const earlyWarningSchema = z.object({
  classId: z.string().uuid().optional(),
  studentId: z.string().uuid().optional(),
});

import { checkEarlyWarning } from '@/features/analytics-ai/services/early-warning.service';

export const POST = withPermission('analytics', 'view', async (request: NextRequest, { user }) => {
  const validation = await validateBody(request, earlyWarningSchema);
  if (!validation.success) { return validationErrorResponse(validation.errors!); }

  try {
    const result = await checkEarlyWarning(validation.data!, user);
    return successResponse(result);
  } catch (error) {
    return errorResponse(error instanceof Error ? error.message : 'Failed to check early warnings', 500);
  }
}, 'ai_generation');
