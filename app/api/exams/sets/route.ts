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
import {
  ensureTeacherAssignmentForSchedule,
  EXAM_SET_SELECT,
  normalizeExamSetRow,
  resolveAcademicContext,
} from '../_lib';

const uuidLikeSchema = z.string().uuid();
const optionalFilterUuid = z.preprocess((value) => {
  if (typeof value !== 'string') {
    return undefined;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return undefined;
  }

  return uuidLikeSchema.safeParse(trimmed).success ? trimmed : undefined;
}, z.string().uuid().optional());

const createExamSetSchema = z.object({
  examId: z.string().uuid(),
  classId: z.string().uuid(),
  termId: z.string().uuid(),
  academicYearId: z.string().uuid().optional().nullable(),
  examDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD'),
  notes: z.string().max(1000).optional().nullable().or(z.literal('')),
});

const examSetFiltersSchema = paginationSchema.extend({
  classId: optionalFilterUuid,
  termId: optionalFilterUuid,
  academicYearId: optionalFilterUuid,
  examId: optionalFilterUuid,
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
    .select(EXAM_SET_SELECT, { count: 'exact' });

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

  const items = (data || []).map(normalizeExamSetRow);

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

  const { data: exam, error: examError } = await supabase
    .from('exam_bank')
    .select('exam_id, learning_area_id')
    .eq('exam_id', payload.examId)
    .eq('school_id', user.schoolId)
    .maybeSingle();

  if (examError) {
    return errorResponse(`Failed to load exam: ${examError.message}`, 500);
  }

  if (!exam) {
    return errorResponse('Exam not found.', 404);
  }

  const { data: classRow, error: classError } = await supabase
    .from('classes')
    .select('class_id')
    .eq('class_id', payload.classId)
    .eq('school_id', user.schoolId)
    .maybeSingle();

  if (classError) {
    return errorResponse(`Failed to load class: ${classError.message}`, 500);
  }

  if (!classRow) {
    return errorResponse('Class not found.', 404);
  }

  let resolvedAcademicYearId: string | null = null;
  let resolvedTermId: string | null = null;
  try {
    const context = await resolveAcademicContext(supabase, user.schoolId, {
      termId: payload.termId,
      academicYearId: payload.academicYearId,
      requireTerm: true,
      requireAcademicYear: true,
    });
    resolvedAcademicYearId = context.academicYearId;
    resolvedTermId = context.termId;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to validate exam schedule.';
    return errorResponse(message, 400);
  }

  try {
    await ensureTeacherAssignmentForSchedule(supabase, user, {
      classId: payload.classId,
      learningAreaId: exam.learning_area_id,
      academicYearId: resolvedAcademicYearId!,
      termId: resolvedTermId!,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'You cannot schedule this exam for the class.';
    return errorResponse(message, 403);
  }

  const timestamp = new Date().toISOString();
  const { data, error } = await supabase
    .from('exam_sets')
    .insert({
      school_id: user.schoolId,
      exam_id: payload.examId,
      class_id: payload.classId,
      term_id: resolvedTermId,
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
    if (error.code === '23505') {
      return errorResponse(
        'This exam is already scheduled for that class, term, and date.',
        409,
      );
    }

    return errorResponse(`Failed to schedule exam: ${error.message}`, 500);
  }

  return createdResponse({
    examSetId: data.exam_set_id,
  });
});
