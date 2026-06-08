export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { withPermission } from '@/lib/api/withAuth';
import { validateBody } from '@/lib/api/validation';
import { errorResponse, successResponse, validationErrorResponse } from '@/lib/api/response';
import { optimizeTimetableSchema, generateTimetableSuggestions } from '@/features/timetable-optimizer';

export const POST = withPermission('timetable', 'create', async (request: NextRequest, { user }) => {
  const validation = await validateBody(request, optimizeTimetableSchema);
  if (!validation.success) { return validationErrorResponse(validation.errors!); }

  try {
    const result = await generateTimetableSuggestions(validation.data!, user);
    return successResponse(result);
  } catch (error) {
    return errorResponse(error instanceof Error ? error.message : 'Failed to generate timetable suggestions', 500);
  }
}, 'ai_generation');
