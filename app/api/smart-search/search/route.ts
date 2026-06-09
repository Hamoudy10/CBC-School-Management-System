export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { withPermission } from '@/lib/api/withAuth';
import { validateBody } from '@/lib/api/validation';
import { errorResponse, successResponse, validationErrorResponse } from '@/lib/api/response';
import { smartSearchSchema, smartSearch } from '@/features/smart-search';

export const POST = withPermission('academics', 'view', async (request: NextRequest, { user }) => {
  const validation = await validateBody(request, smartSearchSchema);
  if (!validation.success) { return validationErrorResponse(validation.errors!); }

  try {
    const result = await smartSearch(validation.data!, user);
    return successResponse(result);
  } catch (error) {
    return errorResponse(error instanceof Error ? error.message : 'Search failed', 500);
  }
}, 'ai_generation');
