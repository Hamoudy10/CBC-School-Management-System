export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { errorResponse, successResponse, validationErrorResponse } from '@/lib/api/response';
import { validateBody } from '@/lib/api/validation';
import { submitApplication, submitApplicationSchema } from '@/features/admissions';
import { rateLimit } from '@/lib/api/rateLimit';

export const POST = async (request: NextRequest) => {
  const ip = request.headers.get('x-forwarded-for') || 'anonymous';
  const rl = rateLimit(ip, 5, 60000);
  if (!rl.allowed) {return errorResponse('Too many requests', 429);}

  const validation = await validateBody(request, submitApplicationSchema);
  if (!validation.success) {return validationErrorResponse(validation.errors!);}
  try {
    const app = await submitApplication(validation.data!);
    return successResponse(app);
  } catch (e) {
    return errorResponse(e instanceof Error ? e.message : 'Submission failed', 500);
  }
};
