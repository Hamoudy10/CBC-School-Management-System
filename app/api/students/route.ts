// @ts-nocheck
import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
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
    .min(1, 'Admission number is required')
    .max(50, 'Admission number must be 50 characters or fewer')
    .trim(),
  date_of_birth: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date of birth must be in YYYY-MM-DD format'),
  gender: z.enum(['male', 'female', 'other'], {
    errorMap: () => ({ message: 'Gender must be male, female, or other' }),
  }),
  current_class_id: z.string().uuid('Invalid class ID').optional().nullable(),
  admission_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Admission date must be in YYYY-MM-DD format')
    .optional()
    .nullable(),
  status: z
    .enum(['active', 'inactive', 'graduated', 'transferred', 'suspended', 'expelled'], {
      errorMap: () => ({ message: 'Invalid student status' }),
    })
    .default('active'),
  photo_url: z.string().url('Invalid photo URL').optional().nullable(),
  medical_info: z.string().max(1000).optional().nullable(),
  special_needs: z.string().max(1000).optional().nullable(),
  nationality: z.string().max(100).trim().optional().nullable(),
  religion: z.string().max(100).trim().optional().nullable(),
  birth_certificate_number: z.string().max(50).trim().optional().nullable(),
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
});

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
  if ('error' in auth && auth.error) return auth.error;

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
        { students: [], total: 0, page, page_size: pageSize, total_pages: 0 },
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
        { students: [], total: 0, page, page_size: pageSize, total_pages: 0 },
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
  if ('error' in auth && auth.error) return auth.error;

  const { schoolId, user } = auth as {
    schoolId: string;
    user: { user_id: string; school_id: string };
  };

  // 2. Parse and validate request body
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return errorResponse('Invalid JSON body', 400);
  }

  const parsed = createStudentSchema.safeParse(body);
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

  const { guardian, ...studentData } = parsed.data;

  // 3. Check for duplicate admission number within the school
  const { data: existingStudent } = await supabase
    .from('students')
    .select('student_id')
    .eq('school_id', schoolId)
    .eq('admission_number', studentData.admission_number)
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
      school_id: schoolId,
      admission_date: studentData.admission_date ?? new Date().toISOString().split('T')[0],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
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
      admission_date,
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
  if (guardian && newStudent) {
    // Check if guardian already exists by phone number
    const { data: existingGuardian } = await supabase
      .from('guardians')
      .select('guardian_id')
      .eq('school_id', schoolId)
      .eq('phone_number', guardian.phone_number)
      .maybeSingle();

    let guardianId: string;

    if (existingGuardian) {
      guardianId = existingGuardian.guardian_id;
    } else {
      // Create new guardian
      const { data: newGuardian, error: guardianError } = await supabase
        .from('guardians')
        .insert({
          first_name: guardian.first_name,
          last_name: guardian.last_name,
          phone_number: guardian.phone_number,
          email: guardian.email ?? null,
          national_id: guardian.national_id ?? null,
          occupation: guardian.occupation ?? null,
          address: guardian.address ?? null,
          school_id: schoolId,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .select('guardian_id')
        .single();

      if (guardianError) {
        // Student was created but guardian failed — log but don't fail the whole request
        console.error('Failed to create guardian:', guardianError.message);
        return successResponse(
          {
            student: newStudent,
            guardian_error: `Student created but guardian creation failed: ${guardianError.message}`,
          },
          'Student created (guardian creation failed)',
          201
        );
      }

      guardianId = newGuardian.guardian_id;
    }

    // Link guardian to student
    const { error: linkError } = await supabase.from('student_guardians').insert({
      student_id: newStudent.student_id,
      guardian_id: guardianId,
      relationship: guardian.relationship,
      is_primary: guardian.is_primary,
      created_at: new Date().toISOString(),
    });

    if (linkError) {
      console.error('Failed to link guardian to student:', linkError.message);
      return successResponse(
        {
          student: newStudent,
          guardian_error: `Student created but guardian linking failed: ${linkError.message}`,
        },
        'Student created (guardian linking failed)',
        201
      );
    }
  }

  return successResponse(
    { student: newStudent },
    'Student created successfully',
    201
  );
}
