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
  ensureTeacherCanEditExam,
  EXAM_SELECT,
  normalizeExamRow,
  resolveAcademicContext,
} from '../_lib';

const idSchema = z.string().uuid();

const baseExamSchema = z.object({
  title: z.string().min(2).max(255),
  description: z.string().max(2000).optional().nullable().or(z.literal('')),
  content: z.string().max(20000).optional().nullable().or(z.literal('')),
  learningAreaId: z.string().uuid(),
  type: z.enum(['exam', 'cat', 'mock', 'past_paper']),
  termId: z.string().uuid().optional().nullable(),
  academicYearId: z.string().uuid().optional().nullable(),
  fileUrl: z.string().url().optional().nullable(),
  fileName: z.string().max(255).optional().nullable(),
  fileType: z.string().max(100).optional().nullable(),
});

const createExamSchema = baseExamSchema.refine(
  (data) =>
    Boolean(data.fileUrl && data.fileUrl.trim()) ||
    Boolean(data.content && data.content.trim()),
  {
    message: 'Provide exam content or upload a file',
    path: ['content'],
  },
);

const updateExamSchema = baseExamSchema.partial();

function formatValidationErrors(error: z.ZodError) {
  const flattened = error.flatten().fieldErrors;
  return Object.fromEntries(
    Object.entries(flattened).map(([key, value]) => [key, value ?? ['Invalid value']]),
  );
}

export const GET = withPermission('exams', 'view', async (_request, { user, params }) => {
  const idValidation = idSchema.safeParse(params.id);
  if (!idValidation.success) {
    return validationErrorResponse({ id: ['Invalid exam ID'] });
  }

  const supabase = await createSupabaseServerClient();
  let query = supabase
    .from('exam_bank')
    .select(EXAM_SELECT)
    .eq('exam_id', idValidation.data);

  if (user.role !== 'super_admin' && user.schoolId) {
    query = query.eq('school_id', user.schoolId);
  }

  const { data, error } = await query.maybeSingle();

  if (error) {
    return errorResponse(`Failed to fetch exam: ${error.message}`, 500);
  }

  if (!data) {
    return notFoundResponse('Exam not found.');
  }

  return successResponse(normalizeExamRow(data));
});

export const PATCH = withPermission('exams', 'update', async (request, { user, params }) => {
  const idValidation = idSchema.safeParse(params.id);
  if (!idValidation.success) {
    return validationErrorResponse({ id: ['Invalid exam ID'] });
  }

  const validation = await validateBody(request, updateExamSchema);
  if (!validation.success) {
    return validationErrorResponse(validation.errors!);
  }

  const supabase = await createSupabaseServerClient();
  let existingQuery = supabase
    .from('exam_bank')
    .select(EXAM_SELECT)
    .eq('exam_id', idValidation.data);

  if (user.role !== 'super_admin' && user.schoolId) {
    existingQuery = existingQuery.eq('school_id', user.schoolId);
  }

  const { data: existing, error: existingError } = await existingQuery.maybeSingle();

  if (existingError) {
    return errorResponse(`Failed to load exam: ${existingError.message}`, 500);
  }

  if (!existing) {
    return notFoundResponse('Exam not found.');
  }

  try {
    await ensureTeacherCanEditExam(user, existing.created_by ?? null);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'You cannot update this exam bank entry.';
    return errorResponse(message, 403);
  }

  const mergedPayload = {
    title: validation.data.title ?? existing.title,
    description:
      validation.data.description !== undefined
        ? validation.data.description
        : existing.description,
    content: validation.data.content !== undefined ? validation.data.content : existing.content,
    learningAreaId: validation.data.learningAreaId ?? existing.learning_area_id,
    type: validation.data.type ?? existing.exam_type,
    termId: validation.data.termId !== undefined ? validation.data.termId : existing.term_id,
    academicYearId:
      validation.data.academicYearId !== undefined
        ? validation.data.academicYearId
        : existing.academic_year_id,
    fileUrl: validation.data.fileUrl !== undefined ? validation.data.fileUrl : existing.file_url,
    fileName:
      validation.data.fileName !== undefined ? validation.data.fileName : existing.file_name,
    fileType:
      validation.data.fileType !== undefined ? validation.data.fileType : existing.file_type,
  };

  const mergedValidation = createExamSchema.safeParse(mergedPayload);
  if (!mergedValidation.success) {
    return validationErrorResponse(formatValidationErrors(mergedValidation.error));
  }

  const payload = mergedValidation.data;

  const { data: learningArea, error: learningAreaError } = await supabase
    .from('learning_areas')
    .select('learning_area_id')
    .eq('learning_area_id', payload.learningAreaId)
    .eq('school_id', existing.school_id)
    .maybeSingle();

  if (learningAreaError) {
    return errorResponse(`Failed to validate learning area: ${learningAreaError.message}`, 500);
  }

  if (!learningArea) {
    return errorResponse('Learning area not found.', 404);
  }

  let resolvedAcademicYearId: string | null = null;
  try {
    const context = await resolveAcademicContext(supabase, existing.school_id, {
      termId: payload.termId,
      academicYearId: payload.academicYearId,
    });
    resolvedAcademicYearId = context.academicYearId;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to validate exam context.';
    return errorResponse(message, 400);
  }

  const { data, error } = await supabase
    .from('exam_bank')
    .update({
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
      updated_at: new Date().toISOString(),
    })
    .eq('exam_id', idValidation.data)
    .eq('school_id', existing.school_id)
    .select(EXAM_SELECT)
    .single();

  if (error) {
    return errorResponse(`Failed to update exam: ${error.message}`, 500);
  }

  return successResponse(normalizeExamRow(data));
});

export const DELETE = withPermission('exams', 'delete', async (_request, { user, params }) => {
  const idValidation = idSchema.safeParse(params.id);
  if (!idValidation.success) {
    return validationErrorResponse({ id: ['Invalid exam ID'] });
  }

  const supabase = await createSupabaseServerClient();
  let existingQuery = supabase
    .from('exam_bank')
    .select('exam_id, school_id')
    .eq('exam_id', idValidation.data);

  if (user.role !== 'super_admin' && user.schoolId) {
    existingQuery = existingQuery.eq('school_id', user.schoolId);
  }

  const { data: existing, error: existingError } = await existingQuery.maybeSingle();

  if (existingError) {
    return errorResponse(`Failed to load exam: ${existingError.message}`, 500);
  }

  if (!existing) {
    return notFoundResponse('Exam not found.');
  }

  const { error } = await supabase
    .from('exam_bank')
    .delete()
    .eq('exam_id', idValidation.data)
    .eq('school_id', existing.school_id);

  if (error) {
    if (error.code === '23503') {
      return errorResponse(
        'This exam is already scheduled. Remove its schedule entries before deleting it.',
        409,
      );
    }

    return errorResponse(`Failed to delete exam: ${error.message}`, 500);
  }

  return noContentResponse();
});
