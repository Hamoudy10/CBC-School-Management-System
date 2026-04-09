// app/api/subjects/[id]/route.ts
// ============================================================
// GET /api/subjects/[id] — Get single subject
// PUT /api/subjects/[id] — Update subject
// DELETE /api/subjects/[id] — Deactivate subject
// ============================================================

export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { withPermission } from '@/lib/api/withAuth';
import { validateBody, validateUuid } from '@/lib/api/validation';
import {
  successResponse,
  errorResponse,
  notFoundResponse,
  validationErrorResponse,
  noContentResponse,
} from '@/lib/api/response';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { z } from 'zod';

const updateSubjectSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  code: z.string().max(20).optional(),
  description: z.string().max(1000).optional(),
  learningAreaId: z.string().uuid().optional(),
  isActive: z.boolean().optional(),
});

export const GET = withPermission('academics', 'view', async (_request, { user, params }) => {
  const id = params?.id;
  if (!id) {return notFoundResponse('Subject ID required');}

  const validation = validateUuid(id);
  if (!validation.success) {return validationErrorResponse(validation.errors!);}

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from('subjects')
    .select('*, learning_area:learning_areas(id, name)')
    .eq('id', id)
    .eq('school_id', user.school_id)
    .maybeSingle();

  if (error) {return errorResponse(error.message, 500);}
  if (!data) {return notFoundResponse('Subject not found');}

  return successResponse(data);
});

export const PUT = withPermission('academics', 'update', async (request, { user, params }) => {
  const id = params?.id;
  if (!id) {return notFoundResponse('Subject ID required');}

  const validation = validateUuid(id);
  if (!validation.success) {return validationErrorResponse(validation.errors!);}

  const bodyValidation = await validateBody(request, updateSubjectSchema);
  if (!bodyValidation.success) {return validationErrorResponse(bodyValidation.errors!);}

  const updateData = bodyValidation.data!;
  if (Object.keys(updateData).length === 0) {return errorResponse('No fields provided', 400);}

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from('subjects')
    .update({ ...updateData, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('school_id', user.school_id);

  if (error) {return errorResponse(error.message, 400);}
  return successResponse({ id, message: 'Subject updated successfully' });
});

export const DELETE = withPermission('academics', 'delete', async (_request, { user, params }) => {
  const id = params?.id;
  if (!id) {return notFoundResponse('Subject ID required');}

  const validation = validateUuid(id);
  if (!validation.success) {return validationErrorResponse(validation.errors!);}

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from('subjects')
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('school_id', user.school_id);

  if (error) {return errorResponse(error.message, 400);}
  return noContentResponse();
});
