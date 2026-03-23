// app/api/exams/route.ts
export const dynamic = 'force-dynamic';

import { z } from 'zod';
import { withPermission } from '@/lib/api/withAuth';
import {
  createdResponse,
  errorResponse,
  paginatedResponse,
  validationErrorResponse,
} from '@/lib/api/response';
import { paginationSchema, validateBody, validateSearchParams } from '@/lib/api/validation';
import { createSupabaseServerClient } from '@/lib/supabase/server';

const examTypeSchema = z.enum(['exam', 'cat', 'mock', 'past_paper']);

const createExamSchema = z
  .object({
    title: z.string().min(2).max(255),
    description: z.string().max(2000).optional().nullable().or(z.literal('')),
    content: z.string().max(20000).optional().nullable().or(z.literal('')),
    learningAreaId: z.string().uuid(),
    type: examTypeSchema,
    termId: z.string().uuid().optional().nullable(),
    academicYearId: z.string().uuid().optional().nullable(),
    fileUrl: z.string().url().optional().nullable(),
    fileName: z.string().max(255).optional().nullable(),
    fileType: z.string().max(100).optional().nullable(),
  })
  .refine(
    (data) =>
      Boolean(data.fileUrl && data.fileUrl.trim()) ||
      Boolean(data.content && data.content.trim()),
    {
      message: 'Provide exam content or upload a file',
      path: ['content'],
    },
  );

const examFiltersSchema = paginationSchema.extend({
  search: z.string().optional(),
  learningAreaId: z.string().uuid().optional(),
  type: examTypeSchema.optional(),
  termId: z.string().uuid().optional(),
  academicYearId: z.string().uuid().optional(),
});

export const GET = withPermission('exams', 'view', async (request, { user }) => {
  const validation = validateSearchParams(request, examFiltersSchema);
  if (!validation.success) {
    return validationErrorResponse(validation.errors!);
  }

  const { page, pageSize, search, learningAreaId, type, termId, academicYearId } =
    validation.data;

  const supabase = await createSupabaseServerClient();
  let query = supabase
    .from('exam_bank')
    .select(
      `
      exam_id,
      school_id,
      learning_area_id,
      title,
      description,
      content,
      exam_type,
      file_url,
      file_name,
      file_type,
      term_id,
      academic_year_id,
      created_by,
      created_at,
      updated_at,
      learning_areas ( name ),
      terms ( name ),
      academic_years ( year )
    `,
      { count: 'exact' },
    );

  if (user.role !== 'super_admin' && user.schoolId) {
    query = query.eq('school_id', user.schoolId);
  }

  if (search && search.trim()) {
    const term = search.trim();
    query = query.or(
      `title.ilike.%${term}%,description.ilike.%${term}%,content.ilike.%${term}%`,
    );
  }
  if (learningAreaId) {
    query = query.eq('learning_area_id', learningAreaId);
  }
  if (type) {
    query = query.eq('exam_type', type);
  }
  if (termId) {
    query = query.eq('term_id', termId);
  }
  if (academicYearId) {
    query = query.eq('academic_year_id', academicYearId);
  }

  const offset = (page - 1) * pageSize;
  const { data, error, count } = await query
    .order('created_at', { ascending: false })
    .range(offset, offset + pageSize - 1);

  if (error) {
    return errorResponse(`Failed to fetch exams: ${error.message}`, 500);
  }

  const items = (data || []).map((row: any) => ({
    examId: row.exam_id,
    learningAreaId: row.learning_area_id,
    title: row.title,
    description: row.description,
    content: row.content,
    type: row.exam_type,
    fileUrl: row.file_url,
    fileName: row.file_name,
    fileType: row.file_type,
    termId: row.term_id,
    academicYearId: row.academic_year_id,
    learningAreaName: row.learning_areas?.name ?? null,
    termName: row.terms?.name ?? null,
    academicYearName: row.academic_years?.year ?? null,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));

  return paginatedResponse(items, count || 0, page, pageSize);
});

export const POST = withPermission('exams', 'create', async (request, { user }) => {
  const validation = await validateBody(request, createExamSchema);
  if (!validation.success) {
    return validationErrorResponse(validation.errors!);
  }

  if (!user.schoolId) {
    return errorResponse('School context required to create exams.');
  }

  const payload = validation.data;
  const supabase = await createSupabaseServerClient();

  const { data: learningArea } = await supabase
    .from('learning_areas')
    .select('learning_area_id')
    .eq('learning_area_id', payload.learningAreaId)
    .eq('school_id', user.schoolId)
    .maybeSingle();

  if (!learningArea) {
    return errorResponse('Learning area not found.', 404);
  }

  let resolvedAcademicYearId = payload.academicYearId ?? null;

  if (payload.termId) {
    const { data: term } = await supabase
      .from('terms')
      .select('term_id, academic_year_id')
      .eq('term_id', payload.termId)
      .eq('school_id', user.schoolId)
      .maybeSingle();

    if (!term) {
      return errorResponse('Term not found.', 404);
    }

    if (resolvedAcademicYearId && term.academic_year_id !== resolvedAcademicYearId) {
      return errorResponse('Selected term does not match the academic year.');
    }

    resolvedAcademicYearId = resolvedAcademicYearId ?? term.academic_year_id;
  }

  if (resolvedAcademicYearId) {
    const { data: year } = await supabase
      .from('academic_years')
      .select('academic_year_id')
      .eq('academic_year_id', resolvedAcademicYearId)
      .eq('school_id', user.schoolId)
      .maybeSingle();

    if (!year) {
      return errorResponse('Academic year not found.', 404);
    }
  }

  const timestamp = new Date().toISOString();
  const { data, error } = await supabase
    .from('exam_bank')
    .insert({
      school_id: user.schoolId,
      learning_area_id: payload.learningAreaId,
      title: payload.title.trim(),
      description: payload.description?.trim() || null,
      content: payload.content?.trim() || null,
      exam_type: payload.type,
      term_id: payload.termId ?? null,
      academic_year_id: resolvedAcademicYearId,
      file_url: payload.fileUrl ?? null,
      file_name: payload.fileName ?? null,
      file_type: payload.fileType ?? null,
      created_by: user.id,
      created_at: timestamp,
      updated_at: timestamp,
    })
    .select('exam_id')
    .single();

  if (error) {
    return errorResponse(`Failed to create exam: ${error.message}`, 500);
  }

  return createdResponse({
    examId: data.exam_id,
  });
});
