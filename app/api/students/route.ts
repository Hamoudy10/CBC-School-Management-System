// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { getCurrentAcademicContext, normalizeStudent } from '@/app/api/students/_utils';
import { z } from 'zod';

// ─── Response Helpers ─────────────────────────────────────────────────────────

function successResponse(data: unknown, message: string, status: number = 200) {
  return NextResponse.json({ success: true, message, data }, { status });
}

function errorResponse(message: string, status: number = 400) {
  return NextResponse.json({ success: false, message, data: null }, { status });
}

// ─── Validation Schemas ───────────────────────────────────────────────────────

const createStudentSchema = z.object({
  first_name: z
    .string()
    .min(1, 'First name is required')
    .max(100, 'First name must be 100 characters or fewer')
    .trim(),
  last_name: z
    .string()
    .min(1, 'Last name is required')
    .max(100, 'Last name must be 100 characters or fewer')
    .trim(),
  middle_name: z
    .string()
    .max(100, 'Middle name must be 100 characters or fewer')
    .trim()
    .optional()
    .nullable(),
  admission_number: z
    .string()
    .max(50, 'Admission number must be 50 characters or fewer')
    .trim()
    .optional()
    .nullable(),
  date_of_birth: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date of birth must be in YYYY-MM-DD format'),
  gender: z.enum(['male', 'female', 'other'], {
    errorMap: () => ({ message: 'Gender must be male, female, or other' }),
  }),
  current_class_id: z.string().uuid('Invalid class ID').optional().nullable(),
  enrollment_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Enrollment date must be in YYYY-MM-DD format')
    .optional()
    .nullable(),
  status: z
    .enum(['active', 'graduated', 'transferred', 'withdrawn', 'suspended'], {
      errorMap: () => ({ message: 'Invalid student status' }),
    })
    .default('active'),
  photo_url: z.string().url('Invalid photo URL').optional().nullable(),
  medical_info: z.string().max(1000).optional().nullable(),
  has_special_needs: z.boolean().optional().nullable(),
  special_needs_details: z.string().max(1000).optional().nullable(),
  nationality: z.string().max(100).trim().optional().nullable(),
  religion: z.string().max(100).trim().optional().nullable(),
  birth_certificate_no: z.string().max(50).trim().optional().nullable(),
  nemis_number: z.string().max(50).trim().optional().nullable(),
  previous_school: z.string().max(200).trim().optional().nullable(),
  transport_mode: z.string().max(100).trim().optional().nullable(),
  blood_group: z.string().max(10).trim().optional().nullable(),

  // Optional guardian data for creation
  guardian: z
    .object({
      first_name: z.string().min(1).max(100).trim(),
      last_name: z.string().min(1).max(100).trim(),
      phone_number: z
        .string()
        .min(10, 'Phone number must be at least 10 digits')
        .max(15)
        .trim(),
      email: z.string().email('Invalid email').optional().nullable(),
      relationship: z.enum([
        'father',
        'mother',
        'guardian',
        'uncle',
        'aunt',
        'grandparent',
        'sibling',
        'other',
      ]),
      is_primary: z.boolean().default(true),
      national_id: z.string().max(20).trim().optional().nullable(),
      occupation: z.string().max(200).trim().optional().nullable(),
      address: z.string().max(500).trim().optional().nullable(),
    })
    .optional()
    .nullable(),
  guardians: z
    .array(
      z.object({
        first_name: z.string().min(1).max(100).trim(),
        last_name: z.string().min(1).max(100).trim(),
        phone_number: z.string().min(10).max(15).trim().optional().nullable(),
        email: z.string().email().optional().nullable(),
        relationship: z.enum([
          'father',
          'mother',
          'guardian',
          'uncle',
          'aunt',
          'grandparent',
          'sibling',
          'other',
        ]),
        is_primary: z.boolean().default(false),
        can_pickup: z.boolean().default(true),
      }),
    )
    .optional()
    .default([]),
});

function normalizeCreateStudentBody(body: Record<string, unknown>) {
  const guardiansInput = Array.isArray(body.guardians) ? body.guardians : [];
  const normalizedGuardians = guardiansInput
    .filter(Boolean)
    .map((guardian: Record<string, unknown>, index) => ({
      first_name: guardian.first_name ?? guardian.firstName ?? '',
      last_name: guardian.last_name ?? guardian.lastName ?? '',
      phone_number: guardian.phone_number ?? guardian.phone ?? null,
      email: guardian.email ?? null,
      relationship: guardian.relationship ?? 'guardian',
      is_primary:
        guardian.is_primary ??
        guardian.isPrimary ??
        guardian.isPrimaryContact ??
        index === 0,
      can_pickup: guardian.can_pickup ?? guardian.canPickup ?? true,
    }));

  const fallbackGuardian = body.guardian
    ? [
        {
          first_name: body.guardian.first_name ?? body.guardian.firstName ?? '',
          last_name: body.guardian.last_name ?? body.guardian.lastName ?? '',
          phone_number: body.guardian.phone_number ?? body.guardian.phone ?? null,
          email: body.guardian.email ?? null,
          relationship: body.guardian.relationship ?? 'guardian',
          is_primary: body.guardian.is_primary ?? true,
          can_pickup: body.guardian.can_pickup ?? true,
        },
      ]
    : [];

  const specialNeedsDetails =
    body.special_needs_details ??
    body.specialNeedsDetails ??
    body.special_needs ??
    null;

  return {
    first_name: body.first_name ?? body.firstName ?? '',
    last_name: body.last_name ?? body.lastName ?? '',
    middle_name: body.middle_name ?? body.middleName ?? null,
    admission_number: body.admission_number ?? body.admissionNumber ?? null,
    date_of_birth: body.date_of_birth ?? body.dateOfBirth ?? '',
    gender: body.gender,
    current_class_id: body.current_class_id ?? body.currentClassId ?? body.classId ?? null,
    enrollment_date:
      body.enrollment_date ?? body.enrollmentDate ?? body.admission_date ?? body.admissionDate ?? null,
    status: body.status ?? 'active',
    photo_url: body.photo_url ?? body.photoUrl ?? null,
    medical_info: body.medical_info ?? body.medicalInfo ?? null,
    has_special_needs:
      body.has_special_needs ?? body.hasSpecialNeeds ?? Boolean(specialNeedsDetails),
    special_needs_details: specialNeedsDetails,
    nationality: body.nationality ?? null,
    religion: body.religion ?? null,
    birth_certificate_no:
      body.birth_certificate_no ??
      body.birthCertificateNo ??
      body.birth_certificate_number ??
      body.birthCertificateNumber ??
      null,
    nemis_number: body.nemis_number ?? body.nemisNumber ?? null,
    previous_school: body.previous_school ?? body.previousSchool ?? null,
    transport_mode: body.transport_mode ?? body.transportMode ?? null,
    blood_group: body.blood_group ?? body.bloodGroup ?? null,
    guardians: normalizedGuardians.length > 0 ? normalizedGuardians : fallbackGuardian,
  };
}

// ─── Auth & School Helper ─────────────────────────────────────────────────────

async function authenticateAndAuthorize(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  requiredRoles: string[]
) {
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();

  if (!authUser) {
    return { error: errorResponse('Unauthorized', 401) };
  }

  const { data: user } = await supabase
    .from('users')
    .select('user_id, school_id, roles ( name )')
    .eq('user_id', authUser.id)
    .single();

  if (!user?.school_id) {
    return { error: errorResponse('Forbidden — no school associated', 403) };
  }

  const roleName = (user.roles as Record<string, string>)?.name ?? 'student';

  if (!requiredRoles.includes(roleName)) {
    return { error: errorResponse('Insufficient permissions', 403) };
  }

  return {
    user,
    roleName,
    schoolId: user.school_id,
    sessionUserId: authUser.id,
  };
}

// ─── GET /api/students ────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const supabase = await createSupabaseServerClient();

  // 1. Auth — all staff roles can list students; parents scoped to children
  const readRoles = [
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
    'ict_admin',
  ];

  const auth = await authenticateAndAuthorize(supabase, readRoles);
  if ('error' in auth && auth.error) {return auth.error;}

  const { schoolId, roleName, user } = auth as {
    schoolId: string;
    roleName: string;
    user: { user_id: string; school_id: string };
  };

  // 2. Parse query params
  const { searchParams } = new URL(req.url);
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10));
  const pageSize = Math.min(
    100,
    Math.max(
      1,
      parseInt(
        searchParams.get('page_size') ??
          searchParams.get('limit') ??
          '20',
        10
      )
    )
  );
  const search = searchParams.get('search')?.trim() ?? '';
  const classId = searchParams.get('class_id') ?? searchParams.get('classId') ?? '';
  const status = searchParams.get('status') ?? '';
  const gender = searchParams.get('gender') ?? '';
  const gradeId = searchParams.get('grade_id') ?? searchParams.get('gradeId') ?? '';
  const requestedSortBy =
    searchParams.get('sort_by') ?? searchParams.get('sortBy') ?? 'first_name';
  const requestedSortOrder =
    searchParams.get('sort_order') ?? searchParams.get('sortOrder') ?? 'asc';
  const sortMap: Record<string, string> = {
    firstName: 'first_name',
    lastName: 'last_name',
    admissionNumber: 'admission_number',
    enrollmentDate: 'enrollment_date',
    dateOfBirth: 'date_of_birth',
    status: 'status',
    createdAt: 'created_at',
  };
  const sortBy = sortMap[requestedSortBy] || requestedSortBy;
  const sortOrder = requestedSortOrder !== 'desc';

  const offset = (page - 1) * pageSize;

  // 3. Build query
  let query = supabase
    .from('students')
    .select(
      `
      student_id,
      school_id,
      user_id,
      first_name,
      last_name,
      middle_name,
      admission_number,
      date_of_birth,
      gender,
      status,
      photo_url,
      birth_certificate_no,
      nemis_number,
      has_special_needs,
      special_needs_details,
      medical_info,
      previous_school,
      enrollment_date,
      current_class_id,
      created_at,
      updated_at,
      classes (
        class_id,
        name,
        stream,
        grade_id
      )
    `,
      { count: 'exact' }
    )
    .eq('school_id', schoolId);

  // 4. Role-based scoping
  if (roleName === 'parent') {
    // Parents can only see their linked children
    const { data: guardianLinks } = await supabase
      .from('student_guardians')
      .select('student_id')
      .eq('guardian_user_id', user.user_id);

    const childrenIds = (guardianLinks ?? []).map((l) => l.student_id);

    if (childrenIds.length === 0) {
      return successResponse(
        {
          data: [],
          students: [],
          total: 0,
          page,
          limit: pageSize,
          totalPages: 0,
          page_size: pageSize,
          total_pages: 0,
        },
        'No linked students found'
      );
    }

    query = query.in('student_id', childrenIds);
  }

  // 5. Apply filters
  if (classId) {
    query = query.eq('current_class_id', classId);
  }

  if (status) {
    query = query.eq('status', status);
  }

  if (gender) {
    query = query.eq('gender', gender);
  }

  if (searchParams.get('hasSpecialNeeds') === 'true' || searchParams.get('has_special_needs') === 'true') {
    query = query.eq('has_special_needs', true);
  }

  // 6. Apply search (name or admission number)
  if (search) {
    // Use ilike for case-insensitive search across multiple columns
    query = query.or(
      `first_name.ilike.%${search}%,last_name.ilike.%${search}%,middle_name.ilike.%${search}%,admission_number.ilike.%${search}%`
    );
  }

  // 7. Apply grade filter (through classes relationship)
  //    Since we can't filter on nested relations directly,
  //    we fetch class IDs for the grade first
  if (gradeId) {
    const { data: gradeClasses } = await supabase
      .from('classes')
      .select('class_id')
      .eq('school_id', schoolId)
      .eq('grade_id', gradeId);

    const gradeClassIds = (gradeClasses ?? []).map((c) => c.class_id);

    if (gradeClassIds.length === 0) {
      return successResponse(
        {
          data: [],
          students: [],
          total: 0,
          page,
          limit: pageSize,
          totalPages: 0,
          page_size: pageSize,
          total_pages: 0,
        },
        'No students found in this grade'
      );
    }

    query = query.in('current_class_id', gradeClassIds);
  }

  // 8. Apply sorting
  const validSortColumns = [
    'first_name',
    'last_name',
    'admission_number',
    'date_of_birth',
    'created_at',
    'admission_date',
    'status',
  ];
  const sortColumn = validSortColumns.includes(sortBy) ? sortBy : 'first_name';
  query = query.order(sortColumn, { ascending: sortOrder });

  // 9. Apply pagination
  query = query.range(offset, offset + pageSize - 1);

  // 10. Execute query
  const { data: students, count, error } = await query;

  if (error) {
    return errorResponse(`Failed to fetch students: ${error.message}`, 500);
  }

  const totalCount = count ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

  const classRows = (students ?? [])
    .map((student) => student.classes)
    .filter(Boolean) as Array<{ grade_id?: string | null }>;
  const gradeIds = Array.from(
    new Set(classRows.map((classRow) => classRow.grade_id).filter(Boolean))
  );

  let gradeMap = new Map<string, string>();
  if (gradeIds.length > 0) {
    const { data: grades } = await supabase
      .from('grades')
      .select('grade_id, name')
      .in('grade_id', gradeIds);

    gradeMap = new Map((grades ?? []).map((grade) => [grade.grade_id, grade.name]));
  }

  const transformedStudents = (students ?? []).map((student) => {
    const currentClass = student.classes
      ? {
          classId: student.classes.class_id,
          name: student.classes.name,
          gradeName: gradeMap.get(student.classes.grade_id) ?? '',
          stream: student.classes.stream,
        }
      : null;

    const birthDate = new Date(student.date_of_birth);
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const hasBirthdayPassed =
      today.getMonth() > birthDate.getMonth() ||
      (today.getMonth() === birthDate.getMonth() &&
        today.getDate() >= birthDate.getDate());
    if (!hasBirthdayPassed) {
      age -= 1;
    }

    return {
      studentId: student.student_id,
      schoolId: student.school_id,
      userId: student.user_id,
      admissionNumber: student.admission_number,
      currentClassId: student.current_class_id,
      dateOfBirth: student.date_of_birth,
      gender: student.gender,
      firstName: student.first_name,
      lastName: student.last_name,
      middleName: student.middle_name,
      enrollmentDate: student.enrollment_date,
      status: student.status,
      photoUrl: student.photo_url,
      birthCertificateNo: student.birth_certificate_no,
      nemisNumber: student.nemis_number,
      hasSpecialNeeds: student.has_special_needs,
      specialNeedsDetails: student.special_needs_details,
      medicalInfo: student.medical_info,
      previousSchool: student.previous_school,
      createdAt: student.created_at,
      updatedAt: student.updated_at,
      fullName: [student.first_name, student.middle_name, student.last_name]
        .filter(Boolean)
        .join(' '),
      age: Number.isFinite(age) ? age : 0,
      currentClass,
      guardians: [],
      feeBalance: 0,
      attendanceRate: null,
    };
  });

  return successResponse(
    {
      data: transformedStudents,
      total: totalCount,
      page,
      limit: pageSize,
      totalPages,
      students: transformedStudents,
      page_size: pageSize,
      total_pages: totalPages,
    },
    `Retrieved ${transformedStudents.length} student(s)`
  );
}

// ─── POST /api/students ───────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const supabase = await createSupabaseServerClient();

  // 1. Auth — only admin/teacher roles can create students
  const writeRoles = [
    'super_admin',
    'school_admin',
    'principal',
    'deputy_principal',
    'teacher',
    'class_teacher',
    'ict_admin',
  ];

  const auth = await authenticateAndAuthorize(supabase, writeRoles);
  if ('error' in auth && auth.error) {return auth.error;}

  const { schoolId, user } = auth as {
    schoolId: string;
    user: { user_id: string; school_id: string };
  };

  // 2. Parse and validate request body
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return errorResponse('Invalid JSON body', 400);
  }

  const normalizedBody = normalizeCreateStudentBody(body);
  const parsed = createStudentSchema.safeParse(normalizedBody);
  if (!parsed.success) {
    const fieldErrors = parsed.error.errors.map((e) => ({
      field: e.path.join('.'),
      message: e.message,
    }));
    return NextResponse.json(
      {
        success: false,
        message: 'Validation failed',
        data: null,
        errors: fieldErrors,
      },
      { status: 400 }
    );
  }

  const { guardians, admission_number, ...studentData } = parsed.data;
  let generatedAdmissionNumber = admission_number;

  if (!generatedAdmissionNumber) {
    const year = new Date().getFullYear();
    const { count } = await supabase
      .from('students')
      .select('student_id', { count: 'exact', head: true })
      .eq('school_id', schoolId)
      .gte('enrollment_date', `${year}-01-01`);

    generatedAdmissionNumber = `ADM-${year}-${String((count ?? 0) + 1).padStart(4, '0')}`;
  }

  // 3. Check for duplicate admission number within the school
  const { data: existingStudent } = await supabase
    .from('students')
    .select('student_id')
    .eq('school_id', schoolId)
    .eq('admission_number', generatedAdmissionNumber)
    .maybeSingle();

  if (existingStudent) {
    return errorResponse(
      `A student with admission number "${studentData.admission_number}" already exists`,
      409
    );
  }

  // 4. If NEMIS number is provided, check for duplicates
  if (studentData.nemis_number) {
    const { data: existingNemis } = await supabase
      .from('students')
      .select('student_id')
      .eq('school_id', schoolId)
      .eq('nemis_number', studentData.nemis_number)
      .maybeSingle();

    if (existingNemis) {
      return errorResponse(
        `A student with NEMIS number "${studentData.nemis_number}" already exists`,
        409
      );
    }
  }

  // 5. If class_id provided, verify it belongs to this school
  if (studentData.current_class_id) {
    const { data: validClass } = await supabase
      .from('classes')
      .select('class_id')
      .eq('class_id', studentData.current_class_id)
      .eq('school_id', schoolId)
      .maybeSingle();

    if (!validClass) {
      return errorResponse('Selected class not found or does not belong to this school', 400);
    }
  }

  // 6. Validate date of birth is not in the future
  const dob = new Date(studentData.date_of_birth);
  if (dob > new Date()) {
    return errorResponse('Date of birth cannot be in the future', 400);
  }

  // 7. Validate age is reasonable for a school student (3–25 years)
  const now = new Date();
  const ageInYears = (now.getTime() - dob.getTime()) / (365.25 * 24 * 60 * 60 * 1000);
  if (ageInYears < 3 || ageInYears > 25) {
    return errorResponse('Student age must be between 3 and 25 years', 400);
  }

  // 8. Insert student record
  const { data: newStudent, error: insertError } = await supabase
    .from('students')
    .insert({
      ...studentData,
      admission_number: generatedAdmissionNumber,
      school_id: schoolId,
      enrollment_date:
        studentData.enrollment_date ?? new Date().toISOString().split('T')[0],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      created_by: user.user_id,
    })
    .select(
      `
      student_id,
      first_name,
      last_name,
      middle_name,
      admission_number,
      date_of_birth,
      gender,
      status,
      photo_url,
      nemis_number,
      enrollment_date,
      current_class_id,
      created_at,
      classes (
        class_id,
        name,
        stream,
        grades ( grade_id, name, level_order )
      )
    `
    )
    .single();

  if (insertError) {
    // Handle unique constraint violations gracefully
    if (insertError.code === '23505') {
      return errorResponse(
        'A student with this admission number or NEMIS number already exists',
        409
      );
    }
    return errorResponse(`Failed to create student: ${insertError.message}`, 500);
  }

  // 9. If guardian data provided, create guardian link
  for (const guardian of guardians ?? []) {
    let guardianId: string | null = null;

    if (guardian.phone_number) {
      const { data: existingGuardian } = await supabase
        .from('guardians')
        .select('guardian_id')
        .eq('school_id', schoolId)
        .eq('phone_number', guardian.phone_number)
        .maybeSingle();

      guardianId = existingGuardian?.guardian_id ?? null;
    }

    if (!guardianId) {
      const { data: createdGuardian, error: guardianError } = await supabase
        .from('guardians')
        .insert({
          school_id: schoolId,
          first_name: guardian.first_name,
          last_name: guardian.last_name,
          phone_number: guardian.phone_number ?? `missing-${Date.now()}`,
          email: guardian.email ?? null,
          created_by: user.user_id,
          updated_by: user.user_id,
        })
        .select('guardian_id')
        .single();

      if (guardianError) {
        console.error('Failed to create guardian:', guardianError.message);
        continue;
      }

      guardianId = createdGuardian.guardian_id;
    }

    const { error: linkError } = await supabase.from('student_guardians').upsert({
      school_id: schoolId,
      student_id: newStudent.student_id,
      guardian_id: guardianId,
      relationship: guardian.relationship,
      is_primary_contact: guardian.is_primary,
      is_primary: guardian.is_primary,
      can_pickup: guardian.can_pickup,
    });

    if (linkError) {
      console.error('Failed to link guardian to student:', linkError.message);
    }
  }

  if (newStudent.current_class_id) {
    const activeContext = await getCurrentAcademicContext(supabase, schoolId);
    if (activeContext.academicYear?.academic_year_id && activeContext.term?.term_id) {
      await supabase.from('student_classes').upsert(
        {
          school_id: schoolId,
          student_id: newStudent.student_id,
          class_id: newStudent.current_class_id,
          academic_year_id: activeContext.academicYear.academic_year_id,
          term_id: activeContext.term.term_id,
          status: 'active',
        },
        { onConflict: 'student_id,academic_year_id,term_id' },
      );
    }
  }

  const normalizedStudent = normalizeStudent(newStudent, [], 0, null);

  return successResponse(
    {
      student: normalizedStudent,
      studentId: normalizedStudent.studentId,
      admissionNumber: normalizedStudent.admissionNumber,
    },
    'Student created successfully',
    201
  );
}
