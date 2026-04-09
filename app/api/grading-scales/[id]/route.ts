// app/api/grading-scales/[id]/route.ts
// ============================================================
// GET /api/grading-scales/[id] — Get single grading scale
// PUT /api/grading-scales/[id] — Update grading scale
// DELETE /api/grading-scales/[id] — Deactivate grading scale
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

const updateSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  minScore: z.coerce.number().min(0).max(100).optional(),
  maxScore: z.coerce.number().min(0).max(100).optional(),
  gradeLabel: z.string().min(1).max(50).optional(),
  description: z.string().max(500).optional(),
  isActive: z.boolean().optional(),
});

export const GET = withPermission('settings', 'view', async (_request, { user, params }) => {
  const id = params?.id;
  if (!id) {return notFoundResponse('Grading scale ID required');}

  const validation = validateUuid(id);
  if (!validation.success) {return validationErrorResponse(validation.errors!);}

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from('grading_scales')
    .select('*')
    .eq('id', id)
    .eq('school_id', user.school_id)
    .maybeSingle();

  if (error) {return errorResponse(error.message, 500);}
  if (!data) {return notFoundResponse('Grading scale not found');}

  return successResponse(data);
});

export const PUT = withPermission('settings', 'update', async (request, { user, params }) => {
  const id = params?.id;
  if (!id) {return notFoundResponse('Grading scale ID required');}

  const validation = validateUuid(id);
  if (!validation.success) {return validationErrorResponse(validation.errors!);}

  const bodyValidation = await validateBody(request, updateSchema);
  if (!bodyValidation.success) {return validationErrorResponse(bodyValidation.errors!);}

  const updateData = bodyValidation.data!;
  if (Object.keys(updateData).length === 0) {return errorResponse('No fields provided', 400);}
  if (updateData.minScore !== undefined && updateData.maxScore !== undefined && updateData.minScore >= updateData.maxScore) {
    return errorResponse('minScore must be less than maxScore', 400);
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from('grading_scales')
    .update({
      ...updateData,
      min_score: updateData.minScore,
      max_score: updateData.maxScore,
      grade_label: updateData.gradeLabel,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('school_id', user.school_id);

  if (error) {return errorResponse(error.message, 400);}
  return successResponse({ id, message: 'Grading scale updated successfully' });
});

export const DELETE = withPermission('settings', 'delete', async (_request, { user, params }) => {
  const id = params?.id;
  if (!id) {return notFoundResponse('Grading scale ID required');}

  const validation = validateUuid(id);
  if (!validation.success) {return validationErrorResponse(validation.errors!);}

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from('grading_scales')
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('school_id', user.school_id);

  if (error) {return errorResponse(error.message, 400);}
  return noContentResponse();
});
