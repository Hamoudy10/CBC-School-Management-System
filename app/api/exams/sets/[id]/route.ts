export const dynamic = 'force-dynamic';

import { z } from 'zod';
import { withPermission } from '@/lib/api/withAuth';
import {
  errorResponse,
  noContentResponse,
  notFoundResponse,
  successResponse,
  validationErrorResponse,
} from '@/lib/api/response';
import { validateBody } from '@/lib/api/validation';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import {
  ensureTeacherAssignmentForSchedule,
  EXAM_SET_SELECT,
  normalizeExamSetRow,
  resolveAcademicContext,
} from '../../_lib';

const idSchema = z.string().uuid();

const createExamSetSchema = z.object({
  examId: z.string().uuid(),
  classId: z.string().uuid(),
  termId: z.string().uuid(),
  academicYearId: z.string().uuid().optional().nullable(),
  examDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD'),
  notes: z.string().max(1000).optional().nullable().or(z.literal('')),
});

const updateExamSetSchema = createExamSetSchema.partial();

function formatValidationErrors(error: z.ZodError) {
  const flattened = error.flatten().fieldErrors;
  return Object.fromEntries(
    Object.entries(flattened).map(([key, value]) => [key, value ?? ['Invalid value']]),
  );
}

export const GET = withPermission('exams', 'view', async (_request, { user, params }) => {
  const idValidation = idSchema.safeParse(params.id);
  if (!idValidation.success) {
    return validationErrorResponse({ id: ['Invalid exam schedule ID'] });
  }

  const supabase = await createSupabaseServerClient();
  let query = supabase
    .from('exam_sets')
    .select(EXAM_SET_SELECT)
    .eq('exam_set_id', idValidation.data);

  if (user.role !== 'super_admin' && user.schoolId) {
    query = query.eq('school_id', user.schoolId);
  }

  const { data, error } = await query.maybeSingle();

  if (error) {
    return errorResponse(`Failed to fetch exam schedule: ${error.message}`, 500);
  }

  if (!data) {
    return notFoundResponse('Exam schedule not found.');
  }

  return successResponse(normalizeExamSetRow(data));
});

export const PATCH = withPermission('exams', 'update', async (request, { user, params }) => {
  const idValidation = idSchema.safeParse(params.id);
  if (!idValidation.success) {
    return validationErrorResponse({ id: ['Invalid exam schedule ID'] });
  }

  const validation = await validateBody(request, updateExamSetSchema);
  if (!validation.success) {
    return validationErrorResponse(validation.errors!);
  }

  const supabase = await createSupabaseServerClient();
  let existingQuery = supabase
    .from('exam_sets')
    .select(EXAM_SET_SELECT)
    .eq('exam_set_id', idValidation.data);

  if (user.role !== 'super_admin' && user.schoolId) {
    existingQuery = existingQuery.eq('school_id', user.schoolId);
  }

  const { data: existing, error: existingError } = await existingQuery.maybeSingle();

  if (existingError) {
    return errorResponse(`Failed to load exam schedule: ${existingError.message}`, 500);
  }

  if (!existing) {
    return notFoundResponse('Exam schedule not found.');
  }

  const mergedPayload = {
    examId: validation.data.examId ?? existing.exam_id,
    classId: validation.data.classId ?? existing.class_id,
    termId: validation.data.termId ?? existing.term_id,
    academicYearId:
      validation.data.academicYearId !== undefined
        ? validation.data.academicYearId
        : existing.academic_year_id,
    examDate: validation.data.examDate ?? existing.exam_date,
    notes: validation.data.notes !== undefined ? validation.data.notes : existing.notes,
  };

  const mergedValidation = createExamSetSchema.safeParse(mergedPayload);
  if (!mergedValidation.success) {
    return validationErrorResponse(formatValidationErrors(mergedValidation.error));
  }

  const payload = mergedValidation.data;

  const { data: exam, error: examError } = await supabase
    .from('exam_bank')
    .select('exam_id, learning_area_id')
    .eq('exam_id', payload.examId)
    .eq('school_id', existing.school_id)
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
    .eq('school_id', existing.school_id)
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
    const context = await resolveAcademicContext(supabase, existing.school_id, {
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
      error instanceof Error ? error.message : 'You cannot update this exam schedule.';
    return errorResponse(message, 403);
  }

  const { data, error } = await supabase
    .from('exam_sets')
    .update({
      exam_id: payload.examId,
      class_id: payload.classId,
      term_id: resolvedTermId,
      academic_year_id: resolvedAcademicYearId,
      exam_date: payload.examDate,
      notes: payload.notes?.trim() || null,
      updated_at: new Date().toISOString(),
    })
    .eq('exam_set_id', idValidation.data)
    .eq('school_id', existing.school_id)
    .select(EXAM_SET_SELECT)
    .single();

  if (error) {
    if (error.code === '23505') {
      return errorResponse(
        'This exam is already scheduled for that class, term, and date.',
        409,
      );
    }

    return errorResponse(`Failed to update exam schedule: ${error.message}`, 500);
  }

  return successResponse(normalizeExamSetRow(data));
});

export const DELETE = withPermission('exams', 'delete', async (_request, { user, params }) => {
  const idValidation = idSchema.safeParse(params.id);
  if (!idValidation.success) {
    return validationErrorResponse({ id: ['Invalid exam schedule ID'] });
  }

  const supabase = await createSupabaseServerClient();
  let existingQuery = supabase
    .from('exam_sets')
    .select('exam_set_id, school_id')
    .eq('exam_set_id', idValidation.data);

  if (user.role !== 'super_admin' && user.schoolId) {
    existingQuery = existingQuery.eq('school_id', user.schoolId);
  }

  const { data: existing, error: existingError } = await existingQuery.maybeSingle();

  if (existingError) {
    return errorResponse(`Failed to load exam schedule: ${existingError.message}`, 500);
  }

  if (!existing) {
    return notFoundResponse('Exam schedule not found.');
  }

  const { error } = await supabase
    .from('exam_sets')
    .delete()
    .eq('exam_set_id', idValidation.data)
    .eq('school_id', existing.school_id);

  if (error) {
    return errorResponse(`Failed to delete exam schedule: ${error.message}`, 500);
  }

  return noContentResponse();
});
