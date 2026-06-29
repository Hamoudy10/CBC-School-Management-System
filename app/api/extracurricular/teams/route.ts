export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { withPermission } from '@/lib/api/withAuth';
import { errorResponse, successResponse, validationErrorResponse } from '@/lib/api/response';
import { validateBody } from '@/lib/api/validation';
import { listTeams, createTeam, createTeamSchema } from '@/features/extracurricular';

export const GET = withPermission('academics', 'view', async (_request, { user }) => {
  try { return successResponse(await listTeams(user.schoolId!)); }
  catch (e) { return errorResponse('Failed to list teams', 500); }
});

export const POST = withPermission('academics', 'create', async (request, { user }) => {
  const v = await validateBody(request, createTeamSchema);
  if (!v.success) {return validationErrorResponse(v.errors!);}
  try { return successResponse(await createTeam(v.data!, user.schoolId!)); }
  catch (e) { return errorResponse(e instanceof Error ? e.message : 'Failed', 500); }
});
