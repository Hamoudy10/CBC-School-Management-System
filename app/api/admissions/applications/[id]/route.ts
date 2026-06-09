export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { withPermission } from '@/lib/api/withAuth';
import { errorResponse, successResponse, validationErrorResponse } from '@/lib/api/response';
import { validateBody } from '@/lib/api/validation';
import { reviewApplication, reviewApplicationSchema } from '@/features/admissions';

export const PATCH = withPermission('students', 'create', async (request: NextRequest, { user, params }) => {
  const validation = await validateBody(request, reviewApplicationSchema);
  if (!validation.success) return validationErrorResponse(validation.errors!);
  try {
    const app = await reviewApplication(params.id, validation.data!, user.id, user.schoolId!);
    return successResponse(app);
  } catch (e) {
    return errorResponse(e instanceof Error ? e.message : 'Review failed', 500);
  }
});
