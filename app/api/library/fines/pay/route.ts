export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { withPermission } from '@/lib/api/withAuth';
import { errorResponse, successResponse } from '@/lib/api/response';
import { payFine } from '@/features/library';

export const POST = withPermission('library', 'update', async (request, { user }) => {
  const { fineId } = await request.json();
  if (!fineId) {return errorResponse('fineId is required', 400);}
  try { await payFine(fineId, user.schoolId!); return successResponse({ paid: true }); }
  catch (e) { return errorResponse(e instanceof Error ? e.message : 'Failed', 500); }
});
