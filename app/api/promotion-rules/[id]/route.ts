// app/api/promotion-rules/[id]/route.ts
// ============================================================
// GET /api/promotion-rules/[id] — Get single rule
// PUT /api/promotion-rules/[id] — Update rule
// DELETE /api/promotion-rules/[id] — Deactivate rule
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
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(1000).optional(),
  minimumAverage: z.coerce.number().min(0).max(100).optional(),
  minimumAttendancePercentage: z.coerce.number().min(0).max(100).optional(),
  maxFailingSubjects: z.coerce.number().int().min(0).optional(),
  allowConditionalPromotion: z.boolean().optional(),
  conditionalRemarksTemplate: z.string().max(500).optional(),
  isActive: z.boolean().optional(),
});

export const GET = withPermission('settings', 'view', async (_request, { user, params }) => {
  const id = params?.id;
  if (!id) {return notFoundResponse('Rule ID required');}

  const validation = validateUuid(id);
  if (!validation.success) {return validationErrorResponse(validation.errors!);}

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from('promotion_rules')
    .select('*')
    .eq('id', id)
    .eq('school_id', user.school_id)
    .maybeSingle();

  if (error) {return errorResponse(error.message, 500);}
  if (!data) {return notFoundResponse('Promotion rule not found');}

  return successResponse(data);
});

export const PUT = withPermission('settings', 'update', async (request, { user, params }) => {
  const id = params?.id;
  if (!id) {return notFoundResponse('Rule ID required');}

  const validation = validateUuid(id);
  if (!validation.success) {return validationErrorResponse(validation.errors!);}

  const bodyValidation = await validateBody(request, updateSchema);
  if (!bodyValidation.success) {return validationErrorResponse(bodyValidation.errors!);}

  const updateData = bodyValidation.data!;
  if (Object.keys(updateData).length === 0) {return errorResponse('No fields provided', 400);}

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from('promotion_rules')
    .update({
      ...updateData,
      minimum_average: updateData.minimumAverage,
      minimum_attendance_percentage: updateData.minimumAttendancePercentage,
      max_failing_subjects: updateData.maxFailingSubjects,
      allow_conditional_promotion: updateData.allowConditionalPromotion,
      conditional_remarks_template: updateData.conditionalRemarksTemplate,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('school_id', user.school_id);

  if (error) {return errorResponse(error.message, 400);}
  return successResponse({ id, message: 'Promotion rule updated successfully' });
});

export const DELETE = withPermission('settings', 'delete', async (_request, { user, params }) => {
  const id = params?.id;
  if (!id) {return notFoundResponse('Rule ID required');}

  const validation = validateUuid(id);
  if (!validation.success) {return validationErrorResponse(validation.errors!);}

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from('promotion_rules')
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('school_id', user.school_id);

  if (error) {return errorResponse(error.message, 400);}
  return noContentResponse();
});
