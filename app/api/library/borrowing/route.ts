export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { withPermission } from '@/lib/api/withAuth';
import { errorResponse, successResponse, validationErrorResponse } from '@/lib/api/response';
import { validateBody } from '@/lib/api/validation';
import { listBorrowings, issueBook, returnBook, issueBookSchema, returnBookSchema } from '@/features/library';

export const GET = withPermission('library', 'view', async (_request, { user }) => {
  try { return successResponse(await listBorrowings(user.schoolId!)); }
  catch (e) { return errorResponse('Failed to list borrowings', 500); }
});

export const POST = withPermission('library', 'create', async (request, { user }) => {
  const v = await validateBody(request, issueBookSchema);
  if (!v.success) {return validationErrorResponse(v.errors!);}
  try { return successResponse(await issueBook(v.data!, user.schoolId!)); }
  catch (e) { return errorResponse(e instanceof Error ? e.message : 'Failed', 500); }
});

export const PATCH = withPermission('library', 'update', async (request, { user }) => {
  const v = await validateBody(request, returnBookSchema);
  if (!v.success) {return validationErrorResponse(v.errors!);}
  try { return successResponse(await returnBook(v.data!, user.schoolId!)); }
  catch (e) { return errorResponse(e instanceof Error ? e.message : 'Failed', 500); }
});
