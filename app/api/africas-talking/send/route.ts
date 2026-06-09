export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { withPermission } from '@/lib/api/withAuth';
import { validateBody } from '@/lib/api/validation';
import { errorResponse, successResponse, validationErrorResponse } from '@/lib/api/response';
import { sendClassNotificationSchema, sendClassNotification } from '@/features/africas-talking';
import { isAfricasTalkingConfigured } from '@/features/africas-talking/services/africas-talking.service';

export const POST = withPermission('communication', 'create', async (request: NextRequest, { user }) => {
  if (!isAfricasTalkingConfigured()) {
    return errorResponse('Africa\'s Talking is not configured. Set AT_API_KEY and AT_USERNAME.', 503);
  }

  const validation = await validateBody(request, sendClassNotificationSchema);
  if (!validation.success) { return validationErrorResponse(validation.errors!); }

  try {
    const result = await sendClassNotification(validation.data!);
    return successResponse(result);
  } catch (error) {
    return errorResponse(error instanceof Error ? error.message : 'Failed to send notification', 500);
  }
});

export async function GET() {
  const configured = isAfricasTalkingConfigured();
  return successResponse({ configured, env: process.env.AT_ENV || 'sandbox' });
}
