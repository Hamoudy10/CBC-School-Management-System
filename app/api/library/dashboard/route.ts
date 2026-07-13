export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { withPermission } from '@/lib/api/withAuth';
import { errorResponse, successResponse } from '@/lib/api/response';
import { getLibraryDashboardStats } from '@/features/library';

export const GET = withPermission('library', 'view', async (_request, { user }) => {
  try { return successResponse(await getLibraryDashboardStats(user.schoolId!)); }
  catch (e) { return errorResponse('Failed to get stats', 500); }
});
