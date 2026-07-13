export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { withPermission } from '@/lib/api/withAuth';
import { errorResponse, successResponse } from '@/lib/api/response';
import { findByBarcode } from '@/features/library';

export const POST = withPermission('library', 'view', async (request, { user }) => {
  const { barcode } = await request.json();
  if (!barcode) {return errorResponse('barcode is required', 400);}
  try { return successResponse(await findByBarcode(barcode, user.schoolId!)); }
  catch (e) { return errorResponse(e instanceof Error ? e.message : 'Failed', 500); }
});
