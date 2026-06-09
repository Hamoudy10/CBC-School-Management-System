export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { withPermission } from '@/lib/api/withAuth';
import { errorResponse, successResponse } from '@/lib/api/response';
import { listApplications, getApplicationStats } from '@/features/admissions';

export const GET = withPermission('students', 'view', async (request: NextRequest, { user }) => {
  const status = request.nextUrl.searchParams.get('status') || undefined;
  try {
    const [applications, stats] = await Promise.all([
      listApplications(user.schoolId!, status),
      getApplicationStats(user.schoolId!),
    ]);
    return successResponse({ applications, stats });
  } catch (e) {
    return errorResponse('Failed to list applications', 500);
  }
});
