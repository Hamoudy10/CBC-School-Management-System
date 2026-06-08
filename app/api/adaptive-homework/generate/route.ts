export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { withPermission } from '@/lib/api/withAuth';
import { validateBody } from '@/lib/api/validation';
import { errorResponse, successResponse, validationErrorResponse } from '@/lib/api/response';
import { generateWorksheetSchema, generateWorksheet } from '@/features/adaptive-homework';

export const POST = withPermission('assessments', 'view', async (request: NextRequest, { user }) => {
  const validation = await validateBody(request, generateWorksheetSchema);
  if (!validation.success) { return validationErrorResponse(validation.errors!); }

  try {
    const result = await generateWorksheet(validation.data!, user);
    return successResponse(result);
  } catch (error) {
    return errorResponse(error instanceof Error ? error.message : 'Failed to generate worksheet', 500);
  }
}, 'ai_generation');
