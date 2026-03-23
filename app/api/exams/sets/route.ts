// app/api/exams/sets/route.ts
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

const createExamSetSchema = z.object({
  examId: z.string().uuid(),
  classId: z.string().uuid(),
  termId: z.string().uuid(),
  academicYearId: z.string().uuid().optional().nullable(),
  examDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD'),
  notes: z.string().max(1000).optional().nullable().or(z.literal('')),
});

const examSetFiltersSchema = paginationSchema.extend({
  classId: z.string().uuid().optional(),
  termId: z.string().uuid().optional(),
  academicYearId: z.string().uuid().optional(),
  examId: z.string().uuid().optional(),
});

export const GET = withPermission('exams', 'view', async (request, { user }) => {
  const validation = validateSearchParams(request, examSetFiltersSchema);
  if (!validation.success) {
    return validationErrorResponse(validation.errors!);
  }

  const { page, pageSize, classId, termId, academicYearId, examId } = validation.data;

  const supabase = await createSupabaseServerClient();
  let query = supabase
    .from('exam_sets')
    .select(
      `
      exam_set_id,
      exam_id,
      class_id,
      term_id,
      academic_year_id,
      exam_date,
      notes,
      created_at,
      exam:exam_bank (
        exam_id,
        title,
        exam_type,
        learning_area_id,
        learning_areas ( name )
      ),
      class:classes (
        class_id,
        name
      ),
      term:terms (
        term_id,
        name
      ),
      year:academic_years (
        academic_year_id,
        year
      )
    `,
      { count: 'exact' },
    );

  if (user.role !== 'super_admin' && user.schoolId) {
    query = query.eq('school_id', user.schoolId);
  }

  if (classId) {
    query = query.eq('class_id', classId);
  }
  if (termId) {
    query = query.eq('term_id', termId);
  }
  if (academicYearId) {
    query = query.eq('academic_year_id', academicYearId);
  }
  if (examId) {
    query = query.eq('exam_id', examId);
  }

  const offset = (page - 1) * pageSize;
  const { data, error, count } = await query
    .order('exam_date', { ascending: true })
    .range(offset, offset + pageSize - 1);

  if (error) {
    return errorResponse(`Failed to fetch exam schedule: ${error.message}`, 500);
  }

  const items = (data || []).map((row: any) => ({
    examSetId: row.exam_set_id,
    examId: row.exam_id,
    classId: row.class_id,
    termId: row.term_id,
    academicYearId: row.academic_year_id,
    examDate: row.exam_date,
    notes: row.notes,
    createdAt: row.created_at,
    exam: row.exam,
    class: row.class,
    term: row.term,
    year: row.year,
    examTitle: row.exam?.title ?? null,
    examType: row.exam?.exam_type ?? null,
    learningAreaName: row.exam?.learning_areas?.name ?? null,
    className: row.class?.name ?? null,
    termName: row.term?.name ?? null,
    academicYearName: row.year?.year ?? null,
  }));

  return paginatedResponse(items, count || 0, page, pageSize);
});

export const POST = withPermission('exams', 'create', async (request, { user }) => {
  const validation = await validateBody(request, createExamSetSchema);
  if (!validation.success) {
    return validationErrorResponse(validation.errors!);
  }

  if (!user.schoolId) {
    return errorResponse('School context required to schedule exams.');
  }

  const payload = validation.data;
  const supabase = await createSupabaseServerClient();

  const { data: exam } = await supabase
    .from('exam_bank')
    .select('exam_id')
    .eq('exam_id', payload.examId)
    .eq('school_id', user.schoolId)
    .maybeSingle();

  if (!exam) {
    return errorResponse('Exam not found.', 404);
  }

  const { data: classRow } = await supabase
    .from('classes')
    .select('class_id')
    .eq('class_id', payload.classId)
    .eq('school_id', user.schoolId)
    .maybeSingle();

  if (!classRow) {
    return errorResponse('Class not found.', 404);
  }

  const { data: term } = await supabase
    .from('terms')
    .select('term_id, academic_year_id')
    .eq('term_id', payload.termId)
    .eq('school_id', user.schoolId)
    .maybeSingle();

  if (!term) {
    return errorResponse('Term not found.', 404);
  }

  const resolvedAcademicYearId = payload.academicYearId ?? term.academic_year_id;
  if (payload.academicYearId && payload.academicYearId !== term.academic_year_id) {
    return errorResponse('Selected term does not match the academic year.');
  }

  const { data: year } = await supabase
    .from('academic_years')
    .select('academic_year_id')
    .eq('academic_year_id', resolvedAcademicYearId)
    .eq('school_id', user.schoolId)
    .maybeSingle();

  if (!year) {
    return errorResponse('Academic year not found.', 404);
  }

  const timestamp = new Date().toISOString();
  const { data, error } = await supabase
    .from('exam_sets')
    .insert({
      school_id: user.schoolId,
      exam_id: payload.examId,
      class_id: payload.classId,
      term_id: payload.termId,
      academic_year_id: resolvedAcademicYearId,
      exam_date: payload.examDate,
      notes: payload.notes?.trim() || null,
      created_by: user.id,
      created_at: timestamp,
      updated_at: timestamp,
    })
    .select('exam_set_id')
    .single();

  if (error) {
    return errorResponse(`Failed to schedule exam: ${error.message}`, 500);
  }

  return createdResponse({
    examSetId: data.exam_set_id,
  });
});
