export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { withPermission } from '@/lib/api/withAuth';
import { errorResponse, successResponse } from '@/lib/api/response';
import { cancelReservation } from '@/features/library';

export const DELETE = withPermission('library', 'update', async (request, { user, params }) => {
  try { await cancelReservation(params.id, user.schoolId!); return successResponse({ cancelled: true }); }
  catch (e) { return errorResponse(e instanceof Error ? e.message : 'Failed', 500); }
});
