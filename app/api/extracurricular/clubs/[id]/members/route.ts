export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { withPermission } from '@/lib/api/withAuth';
import { errorResponse, successResponse, validationErrorResponse } from '@/lib/api/response';
import { validateBody } from '@/lib/api/validation';
import { listMemberships, addMember, addMemberSchema } from '@/features/extracurricular';

export const GET = withPermission('academics', 'view', async (_request, { user, params }) => {
  try { return successResponse(await listMemberships(params.id)); }
  catch (e) { return errorResponse('Failed to list members', 500); }
});

export const POST = withPermission('academics', 'create', async (request, { user }) => {
  const v = await validateBody(request, addMemberSchema);
  if (!v.success) {return validationErrorResponse(v.errors!);}
  try { return successResponse(await addMember(v.data!)); }
  catch (e) { return errorResponse(e instanceof Error ? e.message : 'Failed', 500); }
});
