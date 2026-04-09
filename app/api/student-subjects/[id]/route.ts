// app/api/student-subjects/[id]/route.ts
// ============================================================
// GET /api/student-subjects/[id] — Get single mapping
// DELETE /api/student-subjects/[id] — Remove mapping
// ============================================================

export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { withPermission } from '@/lib/api/withAuth';
import { validateUuid } from '@/lib/api/validation';
import {
  successResponse,
  errorResponse,
  notFoundResponse,
  validationErrorResponse,
  noContentResponse,
} from '@/lib/api/response';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export const GET = withPermission('academics', 'view', async (_request, { user, params }) => {
  const id = params?.id;
  if (!id) {return notFoundResponse('Mapping ID required');}

  const validation = validateUuid(id);
  if (!validation.success) {return validationErrorResponse(validation.errors!);}

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from('student_subjects')
    .select('*, student:students(first_name, last_name), subject:subjects(name, code), teacher:staff(first_name, last_name)')
    .eq('id', id)
    .eq('school_id', user.school_id)
    .maybeSingle();

  if (error) {return errorResponse(error.message, 500);}
  if (!data) {return notFoundResponse('Student subject mapping not found');}

  return successResponse(data);
});

export const DELETE = withPermission('academics', 'delete', async (_request, { user, params }) => {
  const id = params?.id;
  if (!id) {return notFoundResponse('Mapping ID required');}

  const validation = validateUuid(id);
  if (!validation.success) {return validationErrorResponse(validation.errors!);}

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from('student_subjects')
    .delete()
    .eq('id', id)
    .eq('school_id', user.school_id);

  if (error) {return errorResponse(error.message, 400);}
  return noContentResponse();
});
