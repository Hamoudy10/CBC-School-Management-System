// app/api/student-subjects/route.ts
// ============================================================
// GET /api/student-subjects — List student subject mappings
// POST /api/student-subjects — Assign subject to student
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
  pageSize: z.coerce.number().int().min(1).max(100).default(50),
  studentId: z.string().uuid().optional(),
  subjectId: z.string().uuid().optional(),
  teacherId: z.string().uuid().optional(),
  academicYearId: z.string().uuid().optional(),
  termId: z.string().uuid().optional(),
});

const createSchema = z.object({
  studentId: z.string().uuid(),
  subjectId: z.string().uuid(),
  teacherId: z.string().uuid().optional(),
  academicYearId: z.string().uuid().optional(),
  termId: z.string().uuid().optional(),
});

export const GET = withPermission('academics', 'view', async (request: NextRequest, { user }) => {
  const { searchParams } = new URL(request.url);
  const validation = validateQuery(searchParams, filtersSchema);
  if (!validation.success) {return validationErrorResponse(validation.errors!);}

  const filters = validation.data!;
  const supabase = await createSupabaseServerClient();
  const offset = (filters.page - 1) * filters.pageSize;

  let query = supabase
    .from('student_subjects')
    .select(
      `
      *,
      student:students(id, first_name, last_name, admission_no),
      subject:subjects(id, name, code),
      teacher:staff(id, first_name, last_name)
    `,
      { count: 'exact' },
    )
    .eq('school_id', user.school_id)
    .range(offset, offset + filters.pageSize - 1);

  if (filters.studentId) {query = query.eq('student_id', filters.studentId);}
  if (filters.subjectId) {query = query.eq('subject_id', filters.subjectId);}
  if (filters.teacherId) {query = query.eq('teacher_id', filters.teacherId);}
  if (filters.academicYearId) {query = query.eq('academic_year_id', filters.academicYearId);}
  if (filters.termId) {query = query.eq('term_id', filters.termId);}

  const { data, error, count } = await query;
  if (error) {return errorResponse(error.message, 500);}

  return successResponse(data || [], {
    page: filters.page,
    pageSize: filters.pageSize,
    total: count || 0,
    totalPages: Math.ceil((count || 0) / filters.pageSize),
  });
});

export const POST = withPermission('academics', 'create', async (request, { user }) => {
  const validation = await validateBody(request, createSchema);
  if (!validation.success) {return validationErrorResponse(validation.errors!);}

  const data = validation.data!;
  const supabase = await createSupabaseServerClient();

  // Verify student and subject belong to school
  const [studentCheck, subjectCheck] = await Promise.all([
    supabase.from('students').select('id').eq('id', data.studentId).eq('school_id', user.school_id).maybeSingle(),
    supabase.from('subjects').select('id').eq('id', data.subjectId).eq('school_id', user.school_id).maybeSingle(),
  ]);

  if (!studentCheck.data) {return errorResponse('Student not found in this school', 404);}
  if (!subjectCheck.data) {return errorResponse('Subject not found in this school', 404);}

  const { data: newMapping, error } = await supabase
    .from('student_subjects')
    .insert({
      school_id: user.school_id,
      student_id: data.studentId,
      subject_id: data.subjectId,
      teacher_id: data.teacherId || null,
      academic_year_id: data.academicYearId || null,
      term_id: data.termId || null,
    })
    .select('*, student:students(first_name, last_name), subject:subjects(name, code)')
    .single();

  if (error) {
    if (error.code === '23505') {return errorResponse('This student is already assigned to this subject for the selected term/year', 409);}
    return errorResponse(error.message, 400);
  }

  return createdResponse({ id: newMapping.id, mapping: newMapping }, 'Student assigned to subject successfully');
});
