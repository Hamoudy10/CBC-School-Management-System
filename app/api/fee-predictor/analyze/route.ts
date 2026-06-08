export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { withPermission } from '@/lib/api/withAuth';
import { validateBody } from '@/lib/api/validation';
import { errorResponse, successResponse, validationErrorResponse } from '@/lib/api/response';
import { analyzeFeeRiskSchema, analyzeFeeRisk } from '@/features/fee-predictor';

export const POST = withPermission('finance', 'view', async (request: NextRequest, { user }) => {
  const validation = await validateBody(request, analyzeFeeRiskSchema);
  if (!validation.success) { return validationErrorResponse(validation.errors!); }

  try {
    const result = await analyzeFeeRisk(validation.data!, user);
    return successResponse(result);
  } catch (error) {
    return errorResponse(error instanceof Error ? error.message : 'Failed to analyze fee risk', 500);
  }
}, 'ai_generation');
