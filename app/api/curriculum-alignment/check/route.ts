export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { withPermission } from '@/lib/api/withAuth';
import { validateBody } from '@/lib/api/validation';
import { errorResponse, successResponse, validationErrorResponse } from '@/lib/api/response';
import { checkAlignmentSchema, checkCbcAlignment } from '@/features/curriculum-alignment';

export const POST = withPermission('academics', 'view', async (request: NextRequest, { user }) => {
  const validation = await validateBody(request, checkAlignmentSchema);
  if (!validation.success) { return validationErrorResponse(validation.errors!); }

  try {
    const result = await checkCbcAlignment(validation.data!, user);
    return successResponse(result);
  } catch (error) {
    return errorResponse(error instanceof Error ? error.message : 'Failed to check curriculum alignment', 500);
  }
}, 'ai_generation');
