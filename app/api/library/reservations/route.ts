export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { withPermission } from '@/lib/api/withAuth';
import { errorResponse, successResponse, validationErrorResponse } from '@/lib/api/response';
import { validateBody } from '@/lib/api/validation';
import { listReservations, createReservation, createReservationSchema } from '@/features/library';

export const GET = withPermission('library', 'view', async (_request, { user }) => {
  try { return successResponse(await listReservations(user.schoolId!)); }
  catch (e) { return errorResponse('Failed to list reservations', 500); }
});

export const POST = withPermission('library', 'create', async (request, { user }) => {
  const v = await validateBody(request, createReservationSchema);
  if (!v.success) {return validationErrorResponse(v.errors!);}
  try { return successResponse(await createReservation(v.data!, user.schoolId!)); }
  catch (e) { return errorResponse(e instanceof Error ? e.message : 'Failed', 500); }
});
