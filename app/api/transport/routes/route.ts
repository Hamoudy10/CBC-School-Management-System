export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { withPermission } from '@/lib/api/withAuth';
import { errorResponse, successResponse, validationErrorResponse } from '@/lib/api/response';
import { validateBody } from '@/lib/api/validation';
import { listRoutes, createRoute, createRouteSchema } from '@/features/transport';

export const GET = withPermission('timetable', 'view', async (_request, { user }) => {
  try { return successResponse(await listRoutes(user.schoolId!)); }
  catch (e) { return errorResponse('Failed to list routes', 500); }
});

export const POST = withPermission('timetable', 'create', async (request, { user }) => {
  const v = await validateBody(request, createRouteSchema);
  if (!v.success) {return validationErrorResponse(v.errors!);}
  try { return successResponse(await createRoute(v.data!, user.schoolId!)); }
  catch (e) { return errorResponse(e instanceof Error ? e.message : 'Failed', 500); }
});
