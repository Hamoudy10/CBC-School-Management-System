// app/api/promotion-rules/route.ts
// ============================================================
// GET /api/promotion-rules — List promotion rules
// POST /api/promotion-rules — Create promotion rule
// ============================================================

export const dynamic = 'force-dynamic';

import { NextRequest } from 'next/server';
import { withPermission } from '@/lib/api/withAuth';
import { validateBody, validateQuery } from '@/lib/api/validation';
import {
  successResponse,
  createdResponse,
  errorResponse,
  validationErrorResponse,
} from '@/lib/api/response';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { z } from 'zod';

const filtersSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  isActive: z.enum(['true', 'false']).optional(),
});

const createSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(1000).optional(),
  minimumAverage: z.coerce.number().min(0).max(100).optional(),
  minimumAttendancePercentage: z.coerce.number().min(0).max(100).optional(),
  maxFailingSubjects: z.coerce.number().int().min(0).optional(),
  allowConditionalPromotion: z.boolean().default(false),
  conditionalRemarksTemplate: z.string().max(500).optional(),
  isActive: z.boolean().default(true),
});

export const GET = withPermission('settings', 'view', async (request: NextRequest, { user }) => {
  const { searchParams } = new URL(request.url);
  const validation = validateQuery(searchParams, filtersSchema);
  if (!validation.success) {return validationErrorResponse(validation.errors!);}

  const filters = validation.data!;
  const supabase = await createSupabaseServerClient();
  const offset = (filters.page - 1) * filters.pageSize;

  let query = supabase
    .from('promotion_rules')
    .select('*', { count: 'exact' })
    .eq('school_id', user.school_id)
    .order('created_at', { ascending: false })
    .range(offset, offset + filters.pageSize - 1);

  if (filters.isActive) {query = query.eq('is_active', filters.isActive === 'true');}

  const { data, error, count } = await query;
  if (error) {return errorResponse(error.message, 500);}

  return successResponse(data || [], {
    page: filters.page,
    pageSize: filters.pageSize,
    total: count || 0,
    totalPages: Math.ceil((count || 0) / filters.pageSize),
  });
});

export const POST = withPermission('settings', 'create', async (request, { user }) => {
  const validation = await validateBody(request, createSchema);
  if (!validation.success) {return validationErrorResponse(validation.errors!);}

  const data = validation.data!;
  const supabase = await createSupabaseServerClient();

  const { data: newRule, error } = await supabase
    .from('promotion_rules')
    .insert({
      school_id: user.school_id,
      name: data.name,
      description: data.description || null,
      minimum_average: data.minimumAverage || null,
      minimum_attendance_percentage: data.minimumAttendancePercentage || null,
      max_failing_subjects: data.maxFailingSubjects ?? 0,
      allow_conditional_promotion: data.allowConditionalPromotion,
      conditional_remarks_template: data.conditionalRemarksTemplate || null,
      is_active: data.isActive,
      created_by: user.id,
    })
    .select()
    .single();

  if (error) {return errorResponse(error.message, 400);}
  return createdResponse({ id: newRule.id, rule: newRule }, 'Promotion rule created successfully');
});
