export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { withPermission } from '@/lib/api/withAuth';
import { errorResponse, successResponse, validationErrorResponse } from '@/lib/api/response';
import { validateBody } from '@/lib/api/validation';
import { listClubs, createClub, createClubSchema, listMemberships, addMember, addMemberSchema } from '@/features/extracurricular';

export const GET = withPermission('academics', 'view', async (_request, { user }) => {
  try { return successResponse(await listClubs(user.schoolId!)); }
  catch (e) { return errorResponse('Failed to list clubs', 500); }
});

export const POST = withPermission('academics', 'create', async (request, { user }) => {
  const v = await validateBody(request, createClubSchema);
  if (!v.success) return validationErrorResponse(v.errors!);
  try { return successResponse(await createClub(v.data!, user.schoolId!)); }
  catch (e) { return errorResponse(e instanceof Error ? e.message : 'Failed', 500); }
});
