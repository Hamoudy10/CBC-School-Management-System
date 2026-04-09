import { NextRequest } from 'next/server';
import {
  STUDENT_READ_ROLES,
  STUDENT_WRITE_ROLES,
  errorResponse,
  getCurrentAcademicContext,
  getStudentRequestContext,
  normalizeStudent,
  successResponse,
  toArray,
} from '@/app/api/students/_utils';
import { ensureCurrentMandatoryFeesForStudent } from '@/lib/finance/ensureStudentFees';
import { getCurrentFinanceSnapshot } from '@/lib/finance/currentObligations';

const STUDENT_WRITE_COLUMNS = [
  'first_name',
  'last_name',
  'middle_name',
  'admission_number',
  'date_of_birth',
  'gender',
  'current_class_id',
  'enrollment_date',
  'status',
  'photo_url',
  'medical_info',
  'has_special_needs',
  'special_needs_details',
  'birth_certificate_no',
  'nemis_number',
  'previous_school',
] as const;

function toNullIfEmptyString(value: unknown) {
  if (typeof value !== 'string') {
    return value ?? null;
  }

  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function pickWritableStudentFields(input: Record<string, unknown>) {
  return Object.fromEntries(
    STUDENT_WRITE_COLUMNS
      .filter((key) => key in input)
      .map((key) => [key, input[key]]),
  );
}

function normalizeUpdateBody(body: Record<string, unknown>) {
  const specialNeedsDetails =
    body.special_needs_details ??
    body.specialNeedsDetails ??
    body.special_needs ??
    null;

  const normalizedStatus = body.status === 'inactive' ? 'withdrawn' : body.status;

  return {
    first_name: body.first_name ?? body.firstName,
    last_name: body.last_name ?? body.lastName,
    middle_name: body.middle_name ?? body.middleName ?? null,
    admission_number: body.admission_number ?? body.admissionNumber,
    date_of_birth: body.date_of_birth ?? body.dateOfBirth,
    gender: body.gender,
    current_class_id: body.current_class_id ?? body.currentClassId ?? body.classId ?? null,
    enrollment_date:
      body.enrollment_date ?? body.enrollmentDate ?? body.admission_date ?? body.admissionDate,
    status: normalizedStatus,
    photo_url: toNullIfEmptyString(body.photo_url ?? body.photoUrl),
    medical_info: body.medical_info ?? body.medicalInfo ?? null,
    has_special_needs:
      body.has_special_needs ?? body.hasSpecialNeeds ?? Boolean(specialNeedsDetails),
    special_needs_details: specialNeedsDetails,
    previous_school: body.previous_school ?? body.previousSchool ?? null,
    birth_certificate_no:
      body.birth_certificate_no ??
      body.birthCertificateNo ??
      body.birth_certificate_number ??
      null,
    nemis_number: body.nemis_number ?? body.nemisNumber ?? null,
  };
}

async function loadNormalizedStudentDetails(supabase: any, studentId: string, schoolId: string | null) {
  let studentQuery = supabase
    .from('students')
    .select(
      `
      *,
      classes (
        class_id,
        name,
        stream,
        grades ( grade_id, name )
      )
    `,
    )
    .eq('student_id', studentId);

  if (schoolId) {
    studentQuery = studentQuery.eq('school_id', schoolId);
  }

  const { data: student, error: studentError } = await studentQuery.maybeSingle();
  if (studentError) {
    throw new Error(studentError.message);
  }

  if (!student) {
    throw new Error('Student not found');
  }

  const [
    guardianResult,
    attendanceResult,
    disciplineResult,
    context,
  ] = await Promise.all([
    supabase
      .from('student_guardians')
      .select(
        `
        id,
        student_id,
        guardian_user_id,
        relationship,
        is_primary_contact,
        created_at,
        guardian:users (
          user_id,
          first_name,
          last_name,
          phone,
          email
        )
      `,
      )
      .eq('student_id', studentId),
    supabase
      .from('attendance')
      .select('status')
      .eq('student_id', studentId),
    supabase
      .from('disciplinary_records')
      .select('*', { count: 'exact', head: true })
      .eq('student_id', studentId),
    getCurrentAcademicContext(supabase, student.school_id ?? schoolId),
  ]);

  const guardians = guardianResult.data ?? [];
  const attendanceRecords = attendanceResult.data ?? [];
  const financeSnapshot = context.academicYear?.academic_year_id
    ? await getCurrentFinanceSnapshot({
        supabase,
        schoolId: student.school_id ?? schoolId,
        academicYearId: context.academicYear.academic_year_id,
        termId: context.term?.term_id,
        studentId,
        includeInactive: true,
      })
    : { students: [] };
  const financeSummary = financeSnapshot.students[0] ?? null;
  const feeBalance = financeSummary?.balance ?? 0;
  const totalDue = financeSummary?.totalDue ?? 0;
  const totalPaid = financeSummary?.totalPaid ?? 0;

  const totalDays = attendanceRecords.length;
  const presentDays = attendanceRecords.filter(
    (record: { status: string }) => record.status === 'present' || record.status === 'late',
  ).length;
  const attendanceRate = totalDays > 0 ? (presentDays / totalDays) * 100 : null;

  const normalizedStudent = normalizeStudent(student, guardians, feeBalance, attendanceRate);

  let assessmentSummary: Array<{
    learningArea: string;
    averageScore: number;
    performanceLevel: string | null;
  }> = [];

  if (context.term?.term_id) {
    const { data: aggregates } = await supabase
      .from('assessment_aggregates')
      .select(
        `
        average_score,
        overall_level,
        learning_areas ( name )
      `,
      )
      .eq('student_id', studentId)
      .eq('term_id', context.term.term_id);

    assessmentSummary = (aggregates ?? []).map((aggregate: any) => ({
      learningArea: toArray(aggregate.learning_areas)[0]?.name ?? 'Unknown',
      averageScore: Number(aggregate.average_score ?? 0),
      performanceLevel: aggregate.overall_level ?? null,
    }));
  }

  return {
    student: normalizedStudent,
    guardians: normalizedStudent.guardians,
    attendanceSummary: {
      totalDays,
      presentDays: attendanceRecords.filter((record: { status: string }) => record.status === 'present')
        .length,
      absentDays: attendanceRecords.filter((record: { status: string }) => record.status === 'absent')
        .length,
      lateDays: attendanceRecords.filter((record: { status: string }) => record.status === 'late').length,
      excusedDays: attendanceRecords.filter((record: { status: string }) => record.status === 'excused')
        .length,
      attendanceRate: attendanceRate ?? 0,
      studentId,
      termId: context.term?.term_id ?? '',
    },
    feeSummary: {
      studentId,
      academicYearId: context.academicYear?.academic_year_id ?? '',
      termId: context.term?.term_id ?? undefined,
      totalDue,
      totalPaid,
      balance: feeBalance,
      status: financeSummary?.status ?? 'pending',
    },
    disciplineCount: disciplineResult.count ?? 0,
    assessmentSummary,
  };
}

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const context = await getStudentRequestContext(params.id, STUDENT_READ_ROLES);
  if ('error' in context) {
    return context.error;
  }

  try {
    const data = await loadNormalizedStudentDetails(
      context.supabase,
      params.id,
      context.schoolId,
    );

    return successResponse(data, 'Student retrieved successfully');
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to fetch student';
    const status = message === 'Student not found' ? 404 : 500;
    return errorResponse(message, status);
  }
}

// PUT is an alias for PATCH (full update vs partial update — same logic)
export const PUT = PATCH;

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const context = await getStudentRequestContext(params.id, STUDENT_WRITE_ROLES);
  if ('error' in context) {
    return context.error;
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return errorResponse('Invalid JSON body', 400);
  }

  const updateData = pickWritableStudentFields(normalizeUpdateBody(body));
  const sanitizedUpdate = Object.fromEntries(
    Object.entries(updateData).filter(([, value]) => value !== undefined),
  );

  if (Object.keys(sanitizedUpdate).length === 0) {
    return errorResponse('No fields provided for update', 400);
  }

  const validStatuses = ['active', 'transferred', 'graduated', 'withdrawn', 'suspended'];
  if (
    sanitizedUpdate.status &&
    !validStatuses.includes(String(sanitizedUpdate.status))
  ) {
    return errorResponse('Invalid student status', 400);
  }

  if (sanitizedUpdate.current_class_id) {
    const { data: validClass } = await context.supabase
      .from('classes')
      .select('class_id')
      .eq('class_id', sanitizedUpdate.current_class_id)
      .eq('school_id', context.schoolId)
      .maybeSingle();

    if (!validClass) {
      return errorResponse('Selected class not found or does not belong to this school', 400);
    }
  }

  if (sanitizedUpdate.admission_number) {
    const { data: duplicateAdmission } = await context.supabase
      .from('students')
      .select('student_id')
      .eq('school_id', context.schoolId)
      .eq('admission_number', sanitizedUpdate.admission_number)
      .neq('student_id', params.id)
      .maybeSingle();

    if (duplicateAdmission) {
      return errorResponse(
        `A student with admission number "${sanitizedUpdate.admission_number}" already exists`,
        409,
      );
    }
  }

  if (sanitizedUpdate.nemis_number) {
    const { data: duplicateNemis } = await context.supabase
      .from('students')
      .select('student_id')
      .eq('school_id', context.schoolId)
      .eq('nemis_number', sanitizedUpdate.nemis_number)
      .neq('student_id', params.id)
      .maybeSingle();

    if (duplicateNemis) {
      return errorResponse(
        `A student with NEMIS number "${sanitizedUpdate.nemis_number}" already exists`,
        409,
      );
    }
  }

  const { error: updateError } = await context.supabase
    .from('students')
    .update({
      ...sanitizedUpdate,
      updated_at: new Date().toISOString(),
      updated_by: context.user.id,
    })
    .eq('student_id', params.id)
    .eq('school_id', context.schoolId);

  if (updateError) {
    return errorResponse(`Failed to update student: ${updateError.message}`, 500);
  }

  if (sanitizedUpdate.current_class_id) {
    const activeContext = await getCurrentAcademicContext(context.supabase, context.schoolId);
    if (activeContext.academicYear?.academic_year_id && activeContext.term?.term_id) {
      await context.supabase
        .from('student_classes')
        .upsert(
          {
            school_id: context.schoolId,
            student_id: params.id,
            class_id: sanitizedUpdate.current_class_id,
            academic_year_id: activeContext.academicYear.academic_year_id,
            term_id: activeContext.term.term_id,
            status: sanitizedUpdate.status ?? 'active',
          },
          { onConflict: 'student_id,academic_year_id,term_id' },
        );
    }

    try {
      const { data: currentClass } = await context.supabase
        .from('classes')
        .select('grade_id')
        .eq('class_id', sanitizedUpdate.current_class_id)
        .eq('school_id', context.schoolId)
        .maybeSingle();

      await ensureCurrentMandatoryFeesForStudent(context.supabase, {
        schoolId: context.schoolId!,
        studentId: params.id,
        gradeId: (currentClass as any)?.grade_id ?? null,
        userId: context.user.id,
        roleName: context.user.role,
      });
    } catch (feeAssignmentError) {
      console.error('Failed to assign fees after class update:', feeAssignmentError);
    }
  }

  const data = await loadNormalizedStudentDetails(context.supabase, params.id, context.schoolId);
  return successResponse(
    {
      ...data,
      studentId: data.student.studentId,
    },
    'Student updated successfully',
  );
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const context = await getStudentRequestContext(params.id, [
    'super_admin',
    'school_admin',
    'principal',
  ]);
  if ('error' in context) {
    return context.error;
  }

  const hardDelete = new URL(req.url).searchParams.get('hard') === 'true';

  if (hardDelete && context.user.role !== 'super_admin') {
    return errorResponse('Only super administrators can permanently delete student records', 403);
  }

  if (hardDelete) {
    const dependencyTables = ['payments', 'assessments', 'report_cards'];
    for (const table of dependencyTables) {
      const { count } = await context.supabase
        .from(table)
        .select('*', { count: 'exact', head: true })
        .eq('student_id', params.id);

      if ((count ?? 0) > 0) {
        return errorResponse(
          `Cannot permanently delete student: dependent ${table} records exist`,
          409,
        );
      }
    }

    await context.supabase.from('student_guardians').delete().eq('student_id', params.id);
    await context.supabase.from('attendance').delete().eq('student_id', params.id);
    await context.supabase.from('disciplinary_records').delete().eq('student_id', params.id);
    await context.supabase.from('student_fees').delete().eq('student_id', params.id);

    const { error } = await context.supabase
      .from('students')
      .delete()
      .eq('student_id', params.id)
      .eq('school_id', context.schoolId);

    if (error) {
      return errorResponse(`Failed to delete student: ${error.message}`, 500);
    }

    return successResponse({ studentId: params.id, action: 'deleted' }, 'Student permanently deleted');
  }

  const { error } = await context.supabase
    .from('students')
    .update({
      status: 'withdrawn',
      updated_at: new Date().toISOString(),
      updated_by: context.user.id,
    })
    .eq('student_id', params.id)
    .eq('school_id', context.schoolId);

  if (error) {
    return errorResponse(`Failed to withdraw student: ${error.message}`, 500);
  }

  return successResponse(
    { studentId: params.id, action: 'withdrawn' },
    'Student has been withdrawn',
  );
}
