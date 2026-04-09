// app/api/subjects/route.ts
// ============================================================
// GET /api/subjects — List subjects (paginated, filtered)
// POST /api/subjects — Create new subject
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

const subjectFiltersSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  learningAreaId: z.string().uuid().optional(),
  isActive: z.enum(['true', 'false']).optional(),
  search: z.string().max(200).optional(),
});

const createSubjectSchema = z.object({
  name: z.string().min(1).max(200),
  code: z.string().max(20).optional(),
  description: z.string().max(1000).optional(),
  learningAreaId: z.string().uuid().optional(),
  isActive: z.boolean().default(true),
});

export const GET = withPermission('academics', 'view', async (request: NextRequest, { user }) => {
  const { searchParams } = new URL(request.url);
  const validation = validateQuery(searchParams, subjectFiltersSchema);
  if (!validation.success) {
    return validationErrorResponse(validation.errors!);
  }

  const filters = validation.data!;
  const supabase = await createSupabaseServerClient();
  const offset = (filters.page - 1) * filters.pageSize;

  let query = supabase
    .from('subjects')
    .select(
      `
      *,
      learning_area:learning_areas(id, name)
    `,
      { count: 'exact' },
    )
    .eq('school_id', user.school_id)
    .order('name')
    .range(offset, offset + filters.pageSize - 1);

  if (filters.learningAreaId) {query = query.eq('learning_area_id', filters.learningAreaId);}
  if (filters.isActive) {query = query.eq('is_active', filters.isActive === 'true');}
  if (filters.search) {query = query.ilike('name', `%${filters.search}%`);}

  const { data, error, count } = await query;
  if (error) {return errorResponse(error.message, 500);}

  return successResponse(data || [], {
    page: filters.page,
    pageSize: filters.pageSize,
    total: count || 0,
    totalPages: Math.ceil((count || 0) / filters.pageSize),
  });
});

export const POST = withPermission('academics', 'create', async (request: NextRequest, { user }) => {
  const validation = await validateBody(request, createSubjectSchema);
  if (!validation.success) {
    return validationErrorResponse(validation.errors!);
  }

  const data = validation.data!;
  const supabase = await createSupabaseServerClient();

  // Check for duplicate code
  if (data.code) {
    const { data: existing } = await supabase
      .from('subjects')
      .select('id')
      .eq('code', data.code)
      .maybeSingle();
    if (existing) {return errorResponse(`A subject with code "${data.code}" already exists`, 409);}
  }

  const { data: newSubject, error } = await supabase
    .from('subjects')
    .insert({
      ...data,
      school_id: user.school_id,
      created_by: user.id,
    })
    .select('*, learning_area:learning_areas(id, name)')
    .single();

  if (error) {return errorResponse(error.message, 400);}

  return createdResponse({ id: newSubject.id, subject: newSubject }, 'Subject created successfully');
});
