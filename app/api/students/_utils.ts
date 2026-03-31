import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth/session';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export const STUDENT_READ_ROLES = [
  'super_admin',
  'school_admin',
  'principal',
  'deputy_principal',
  'teacher',
  'class_teacher',
  'subject_teacher',
  'finance_officer',
  'bursar',
  'ict_admin',
  'parent',
  'student',
] as const;

export const STUDENT_WRITE_ROLES = [
  'super_admin',
  'school_admin',
  'principal',
  'deputy_principal',
  'teacher',
  'class_teacher',
  'ict_admin',
] as const;

export const STUDENT_FINANCE_ROLES = [
  'super_admin',
  'school_admin',
  'principal',
  'deputy_principal',
  'teacher',
  'class_teacher',
  'subject_teacher',
  'finance_officer',
  'bursar',
  'parent',
  'student',
] as const;

const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function successResponse(data: unknown, message: string, status = 200) {
  return NextResponse.json({ success: true, message, data }, { status });
}

export function errorResponse(message: string, status = 400) {
  return NextResponse.json({ success: false, message, data: null }, { status });
}

export function validateStudentId(studentId: string) {
  if (!studentId || !uuidRegex.test(studentId)) {
    return errorResponse('Invalid student ID format', 400);
  }

  return null;
}

export function toArray<T>(value: T | T[] | null | undefined): T[] {
  if (Array.isArray(value)) {
    return value;
  }

  return value ? [value] : [];
}

export function getSingleRelation<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return value ?? null;
}

export function calculateAge(dateOfBirth: string | null | undefined) {
  if (!dateOfBirth) {
    return 0;
  }

  const birthDate = new Date(dateOfBirth);
  if (Number.isNaN(birthDate.getTime())) {
    return 0;
  }

  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();

  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age -= 1;
  }

  return age;
}

export function normalizeGuardian(link: any) {
  const guardianUser = getSingleRelation(link.guardian ?? link.users);
  const source = guardianUser;

  const userId =
    source?.user_id ??
    source?.guardian_user_id ??
    link.guardian_user_id ??
    link.id;

  return {
    id: link.id ?? `${link.student_id}-${link.guardian_user_id ?? userId}`,
    studentId: link.student_id,
    guardianUserId: link.guardian_user_id ?? userId ?? '',
    relationship: link.relationship ?? 'guardian',
    isPrimaryContact: Boolean(link.is_primary_contact ?? link.is_primary),
    canPickup: Boolean(link.can_pickup ?? true),
    createdAt: link.created_at ?? new Date().toISOString(),
    guardian: source
      ? {
          userId,
          firstName: source.first_name ?? '',
          lastName: source.last_name ?? '',
          email: source.email ?? '',
          phone: source.phone ?? null,
        }
      : null,
  };
}

export function normalizeStudent(
  row: any,
  guardians: any[] = [],
  feeBalance = 0,
  attendanceRate: number | null = null,
) {
  const currentClassSource = getSingleRelation(row.current_class ?? row.classes);
  const currentGradeSource = getSingleRelation(
    currentClassSource?.grade ?? currentClassSource?.grades,
  );

  const firstName = row.first_name ?? row.firstName ?? '';
  const middleName = row.middle_name ?? row.middleName ?? null;
  const lastName = row.last_name ?? row.lastName ?? '';
  const normalizedGuardians = guardians.map(normalizeGuardian);

  return {
    studentId: row.student_id ?? row.studentId,
    schoolId: row.school_id ?? row.schoolId,
    userId: row.user_id ?? row.userId ?? null,
    admissionNumber: row.admission_number ?? row.admissionNumber ?? '',
    currentClassId: row.current_class_id ?? row.currentClassId ?? null,
    dateOfBirth: row.date_of_birth ?? row.dateOfBirth ?? '',
    gender: row.gender,
    firstName,
    lastName,
    middleName,
    enrollmentDate:
      row.enrollment_date ?? row.enrollmentDate ?? row.admission_date ?? row.admissionDate ?? '',
    status: row.status,
    photoUrl: row.photo_url ?? row.photoUrl ?? null,
    birthCertificateNo:
      row.birth_certificate_no ?? row.birthCertificateNo ?? row.birth_certificate_number ?? null,
    nemisNumber: row.nemis_number ?? row.nemisNumber ?? null,
    hasSpecialNeeds: Boolean(row.has_special_needs ?? row.hasSpecialNeeds ?? row.special_needs),
    specialNeedsDetails:
      row.special_needs_details ?? row.specialNeedsDetails ?? row.special_needs ?? null,
    medicalInfo: row.medical_info ?? row.medicalInfo ?? null,
    previousSchool: row.previous_school ?? row.previousSchool ?? null,
    createdAt: row.created_at ?? row.createdAt ?? new Date().toISOString(),
    updatedAt: row.updated_at ?? row.updatedAt ?? new Date().toISOString(),
    fullName: [firstName, middleName, lastName].filter(Boolean).join(' '),
    age: calculateAge(row.date_of_birth ?? row.dateOfBirth ?? null),
    currentClass: currentClassSource
      ? {
          classId: currentClassSource.class_id,
          name: currentClassSource.name ?? '',
          gradeName: currentGradeSource?.name ?? '',
          stream: currentClassSource.stream ?? null,
        }
      : null,
    guardians: normalizedGuardians,
    feeBalance,
    attendanceRate,
  };
}

export async function getStudentRequestContext(
  studentId: string,
  allowedRoles: readonly string[] = STUDENT_READ_ROLES,
) {
  const validationError = validateStudentId(studentId);
  if (validationError) {
    return { error: validationError };
  }

  const user = await getCurrentUser();
  if (!user) {
    return { error: errorResponse('Unauthorized', 401) };
  }

  if (!allowedRoles.includes(user.role)) {
    return { error: errorResponse('Insufficient permissions', 403) };
  }

  const supabase = await createSupabaseServerClient();
  const schoolId = user.schoolId ?? user.school_id ?? null;

  let studentQuery = supabase
    .from('students')
    .select('student_id, school_id, user_id, current_class_id, first_name, last_name, status')
    .eq('student_id', studentId);

  if (user.role !== 'super_admin' && schoolId) {
    studentQuery = studentQuery.eq('school_id', schoolId);
  }

  const { data: student, error: studentError } = await studentQuery.maybeSingle();
  if (studentError) {
    return { error: errorResponse(`Failed to load student context: ${studentError.message}`, 500) };
  }

  if (!student) {
    return { error: errorResponse('Student not found', 404) };
  }

  const currentUserId = user.user_id ?? user.id;

  if (user.role === 'parent') {
    const { data: link } = await supabase
      .from('student_guardians')
      .select('id')
      .eq('student_id', studentId)
      .eq('guardian_user_id', currentUserId)
      .maybeSingle();

    if (!link) {
      return { error: errorResponse('You do not have access to this student record', 403) };
    }
  }

  if (user.role === 'student' && student.user_id !== currentUserId) {
    return { error: errorResponse('You can only view your own student record', 403) };
  }

  return {
    supabase,
    user,
    schoolId: student.school_id ?? schoolId,
    student,
  };
}

export async function getCurrentAcademicContext(supabase: any, schoolId: string | null) {
  if (!schoolId) {
    return {
      academicYear: null,
      term: null,
    };
  }

  let { data: academicYear } = await supabase
    .from('academic_years')
    .select('academic_year_id, year')
    .eq('school_id', schoolId)
    .eq('is_active', true)
    .maybeSingle();

  if (!academicYear) {
    const { data: latestYear } = await supabase
      .from('academic_years')
      .select('academic_year_id, year')
      .eq('school_id', schoolId)
      .order('start_date', { ascending: false })
      .limit(1)
      .maybeSingle();

    academicYear = latestYear ?? null;
  }

  let term = null;
  if (academicYear?.academic_year_id) {
    const { data: activeTerm } = await supabase
      .from('terms')
      .select('term_id, name, academic_year_id')
      .eq('school_id', schoolId)
      .eq('academic_year_id', academicYear.academic_year_id)
      .eq('is_active', true)
      .maybeSingle();

    term = activeTerm ?? null;

    if (!term) {
      const { data: latestTerm } = await supabase
        .from('terms')
        .select('term_id, name, academic_year_id')
        .eq('school_id', schoolId)
        .eq('academic_year_id', academicYear.academic_year_id)
        .order('start_date', { ascending: false })
        .limit(1)
        .maybeSingle();

      term = latestTerm ?? null;
    }
  }

  return { academicYear, term };
}
