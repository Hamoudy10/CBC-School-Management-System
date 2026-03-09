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

const updateStudentSchema = z
  .object({
    first_name: z
      .string()
      .min(1, 'First name is required')
      .max(100, 'First name must be 100 characters or fewer')
      .trim()
      .optional(),
    last_name: z
      .string()
      .min(1, 'Last name is required')
      .max(100, 'Last name must be 100 characters or fewer')
      .trim()
      .optional(),
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
      .trim()
      .optional(),
    date_of_birth: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date of birth must be in YYYY-MM-DD format')
      .optional(),
    gender: z
      .enum(['male', 'female', 'other'], {
        errorMap: () => ({ message: 'Gender must be male, female, or other' }),
      })
      .optional(),
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
      .optional(),
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
  })
  .strict();

// ─── Auth Helper ──────────────────────────────────────────────────────────────

interface AuthResult {
  userId: string;
  schoolId: string;
  roleName: string;
}

async function authenticate(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>
): Promise<{ auth: AuthResult } | { error: NextResponse }> {
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

  return {
    auth: {
      userId: user.user_id,
      schoolId: user.school_id,
      roleName,
    },
  };
}

// ─── Param Helper ─────────────────────────────────────────────────────────────

interface RouteContext {
  params: { id: string };
}

const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function validateStudentId(id: string): NextResponse | null {
  if (!id || !uuidRegex.test(id)) {
    return errorResponse('Invalid student ID format', 400);
  }
  return null;
}

// ─── GET /api/students/[id] ───────────────────────────────────────────────────

export async function GET(req: NextRequest, { params }: RouteContext) {
  const supabase = await createSupabaseServerClient();

  // 1. Auth
  const result = await authenticate(supabase);
  if ('error' in result) return result.error;
  const { schoolId, roleName, userId } = result.auth;

  // 2. Validate ID
  const idError = validateStudentId(params.id);
  if (idError) return idError;

  const studentId = params.id;

  // 3. Role check — all staff + parent (scoped) + student (self only)
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
    'ict_admin',
    'parent',
    'student',
  ];

  if (!readRoles.includes(roleName)) {
    return errorResponse('Insufficient permissions', 403);
  }

  // 4. Parent scoping — verify they are linked to this student
  if (roleName === 'parent') {
    const { data: guardianLink } = await supabase
      .from('student_guardians')
      .select('student_id')
      .eq('guardian_user_id', userId)
      .eq('student_id', studentId)
      .maybeSingle();

    if (!guardianLink) {
      return errorResponse('You do not have access to this student record', 403);
    }
  }

  // 5. Student scoping — can only view their own record
  if (roleName === 'student') {
    const { data: studentRecord } = await supabase
      .from('students')
      .select('student_id')
      .eq('user_id', userId)
      .eq('student_id', studentId)
      .maybeSingle();

    if (!studentRecord) {
      return errorResponse('You can only view your own student record', 403);
    }
  }

  // 6. Fetch student with full details
  const { data: student, error: fetchError } = await supabase
    .from('students')
    .select(
      `
      *,
      classes (
        class_id,
        name,
        stream,
        grades ( grade_id, name, level )
      )
    `
    )
    .eq('student_id', studentId)
    .eq('school_id', schoolId)
    .maybeSingle();

  if (fetchError) {
    return errorResponse(`Failed to fetch student: ${fetchError.message}`, 500);
  }

  if (!student) {
    return errorResponse('Student not found', 404);
  }

  // 7. Fetch guardians
  const { data: guardianLinks } = await supabase
    .from('student_guardians')
    .select(
      `
      relationship,
      is_primary,
      guardians (
        guardian_id,
        first_name,
        last_name,
        phone_number,
        email,
        national_id,
        occupation,
        address
      )
    `
    )
    .eq('student_id', studentId);

  const guardians = (guardianLinks ?? []).map((link) => ({
    ...(link.guardians as Record<string, unknown>),
    relationship: link.relationship,
    is_primary: link.is_primary,
  }));

  // 8. Fetch recent attendance summary (last 30 days)
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const { data: attendanceRecords } = await supabase
    .from('attendance')
    .select('status')
    .eq('student_id', studentId)
    .gte('date', thirtyDaysAgo.toISOString().split('T')[0]);

  const attendanceSummary = {
    total_days: (attendanceRecords ?? []).length,
    present: (attendanceRecords ?? []).filter((a) => a.status === 'present').length,
    absent: (attendanceRecords ?? []).filter((a) => a.status === 'absent').length,
    late: (attendanceRecords ?? []).filter((a) => a.status === 'late').length,
    excused: (attendanceRecords ?? []).filter((a) => a.status === 'excused').length,
  };

  // 9. Fetch fee balance summary
  const { data: feeRecords } = await supabase
    .from('student_fees')
    .select('amount, paid_amount, balance, fee_structures ( name, fee_type )')
    .eq('student_id', studentId);

  const feeSummary = {
    total_fees: (feeRecords ?? []).reduce(
      (sum, f) => sum + (typeof f.amount === 'number' ? f.amount : 0),
      0
    ),
    total_paid: (feeRecords ?? []).reduce(
      (sum, f) => sum + (typeof f.paid_amount === 'number' ? f.paid_amount : 0),
      0
    ),
    total_balance: (feeRecords ?? []).reduce(
      (sum, f) => sum + (typeof f.balance === 'number' ? f.balance : 0),
      0
    ),
    fee_items: (feeRecords ?? []).map((f) => ({
      name:
        (f.fee_structures as Record<string, unknown> | null)?.name ?? 'Unknown',
      fee_type:
        (f.fee_structures as Record<string, unknown> | null)?.fee_type ?? 'other',
      amount: f.amount,
      paid_amount: f.paid_amount,
      balance: f.balance,
    })),
  };

  // 10. Fetch recent disciplinary records count
  const { count: disciplineCount } = await supabase
    .from('disciplinary_records')
    .select('*', { count: 'exact', head: true })
    .eq('student_id', studentId);

  // 11. Fetch latest assessment aggregates (current term if available)
  const { data: activeTerm } = await supabase
    .from('terms')
    .select('term_id')
    .eq('school_id', schoolId)
    .eq('is_active', true)
    .maybeSingle();

  let assessmentSummary: Array<Record<string, unknown>> = [];

  if (activeTerm) {
    const { data: aggregates } = await supabase
      .from('assessment_aggregates')
      .select(
        `
        average_score,
        performance_level,
        learning_areas ( name )
      `
      )
      .eq('student_id', studentId)
      .eq('term_id', activeTerm.term_id);

    assessmentSummary = (aggregates ?? []).map((agg) => ({
      learning_area:
        (agg.learning_areas as Record<string, string> | null)?.name ?? 'Unknown',
      average_score: agg.average_score,
      performance_level: agg.performance_level,
    }));
  }

  // 12. Compose response
  return successResponse(
    {
      student,
      guardians,
      attendance_summary: attendanceSummary,
      fee_summary: feeSummary,
      discipline_count: disciplineCount ?? 0,
      assessment_summary: assessmentSummary,
    },
    'Student retrieved successfully'
  );
}

// ─── PATCH /api/students/[id] ─────────────────────────────────────────────────

export async function PATCH(req: NextRequest, { params }: RouteContext) {
  const supabase = await createSupabaseServerClient();

  // 1. Auth
  const result = await authenticate(supabase);
  if ('error' in result) return result.error;
  const { schoolId, roleName } = result.auth;

  // 2. Validate ID
  const idError = validateStudentId(params.id);
  if (idError) return idError;

  const studentId = params.id;

  // 3. Role check — only admin/teacher roles can update
  const writeRoles = [
    'super_admin',
    'school_admin',
    'principal',
    'deputy_principal',
    'teacher',
    'class_teacher',
    'ict_admin',
  ];

  if (!writeRoles.includes(roleName)) {
    return errorResponse('Insufficient permissions', 403);
  }

  // 4. Verify student exists and belongs to this school
  const { data: existingStudent } = await supabase
    .from('students')
    .select('student_id, admission_number, nemis_number')
    .eq('student_id', studentId)
    .eq('school_id', schoolId)
    .maybeSingle();

  if (!existingStudent) {
    return errorResponse('Student not found', 404);
  }

  // 5. Parse and validate request body
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return errorResponse('Invalid JSON body', 400);
  }

  const parsed = updateStudentSchema.safeParse(body);
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

  const updateData = parsed.data;

  // 6. If no fields to update, return early
  if (Object.keys(updateData).length === 0) {
    return errorResponse('No fields provided for update', 400);
  }

  // 7. If admission_number is being changed, check for duplicates
  if (
    updateData.admission_number &&
    updateData.admission_number !== existingStudent.admission_number
  ) {
    const { data: duplicateAdm } = await supabase
      .from('students')
      .select('student_id')
      .eq('school_id', schoolId)
      .eq('admission_number', updateData.admission_number)
      .neq('student_id', studentId)
      .maybeSingle();

    if (duplicateAdm) {
      return errorResponse(
        `A student with admission number "${updateData.admission_number}" already exists`,
        409
      );
    }
  }

  // 8. If nemis_number is being changed, check for duplicates
  if (
    updateData.nemis_number !== undefined &&
    updateData.nemis_number !== null &&
    updateData.nemis_number !== existingStudent.nemis_number
  ) {
    const { data: duplicateNemis } = await supabase
      .from('students')
      .select('student_id')
      .eq('school_id', schoolId)
      .eq('nemis_number', updateData.nemis_number)
      .neq('student_id', studentId)
      .maybeSingle();

    if (duplicateNemis) {
      return errorResponse(
        `A student with NEMIS number "${updateData.nemis_number}" already exists`,
        409
      );
    }
  }

  // 9. If class_id is being changed, verify it belongs to this school
  if (updateData.current_class_id) {
    const { data: validClass } = await supabase
      .from('classes')
      .select('class_id')
      .eq('class_id', updateData.current_class_id)
      .eq('school_id', schoolId)
      .maybeSingle();

    if (!validClass) {
      return errorResponse(
        'Selected class not found or does not belong to this school',
        400
      );
    }
  }

  // 10. If date_of_birth is being changed, validate age
  if (updateData.date_of_birth) {
    const dob = new Date(updateData.date_of_birth);
    if (dob > new Date()) {
      return errorResponse('Date of birth cannot be in the future', 400);
    }

    const now = new Date();
    const ageInYears =
      (now.getTime() - dob.getTime()) / (365.25 * 24 * 60 * 60 * 1000);
    if (ageInYears < 3 || ageInYears > 25) {
      return errorResponse('Student age must be between 3 and 25 years', 400);
    }
  }

  // 11. Execute update
  const { data: updatedStudent, error: updateError } = await supabase
    .from('students')
    .update({
      ...updateData,
      updated_at: new Date().toISOString(),
    })
    .eq('student_id', studentId)
    .eq('school_id', schoolId)
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
      medical_info,
      special_needs,
      nationality,
      religion,
      birth_certificate_number,
      previous_school,
      transport_mode,
      blood_group,
      created_at,
      updated_at,
      classes (
        class_id,
        name,
        stream,
        grades ( grade_id, name, level )
      )
    `
    )
    .single();

  if (updateError) {
    if (updateError.code === '23505') {
      return errorResponse(
        'A student with this admission number or NEMIS number already exists',
        409
      );
    }
    return errorResponse(`Failed to update student: ${updateError.message}`, 500);
  }

  return successResponse(
    { student: updatedStudent },
    'Student updated successfully'
  );
}

// ─── DELETE /api/students/[id] ────────────────────────────────────────────────

export async function DELETE(req: NextRequest, { params }: RouteContext) {
  const supabase = await createSupabaseServerClient();

  // 1. Auth
  const result = await authenticate(supabase);
  if ('error' in result) return result.error;
  const { schoolId, roleName } = result.auth;

  // 2. Validate ID
  const idError = validateStudentId(params.id);
  if (idError) return idError;

  const studentId = params.id;

  // 3. Role check — only admin roles can delete students
  const deleteRoles = ['super_admin', 'school_admin', 'principal'];

  if (!deleteRoles.includes(roleName)) {
    return errorResponse('Insufficient permissions — only administrators can delete students', 403);
  }

  // 4. Verify student exists and belongs to this school
  const { data: existingStudent } = await supabase
    .from('students')
    .select('student_id, first_name, last_name, status')
    .eq('student_id', studentId)
    .eq('school_id', schoolId)
    .maybeSingle();

  if (!existingStudent) {
    return errorResponse('Student not found', 404);
  }

  // 5. Check for deletion strategy from query params
  const { searchParams } = new URL(req.url);
  const hardDelete = searchParams.get('hard') === 'true';

  if (hardDelete) {
    // Hard delete — only super_admin can do this
    if (roleName !== 'super_admin') {
      return errorResponse(
        'Only super administrators can permanently delete student records',
        403
      );
    }

    // 6a. Check for dependent records that would prevent deletion
    const dependencyChecks = [
      {
        table: 'payments',
        label: 'payment records',
      },
      {
        table: 'assessments',
        label: 'assessment records',
      },
      {
        table: 'report_cards',
        label: 'report cards',
      },
    ];

    for (const dep of dependencyChecks) {
      const { count } = await supabase
        .from(dep.table)
        .select('*', { count: 'exact', head: true })
        .eq('student_id', studentId);

      if (count && count > 0) {
        return errorResponse(
          `Cannot permanently delete student: ${count} ${dep.label} exist. ` +
            `Deactivate the student instead, or remove the ${dep.label} first.`,
          409
        );
      }
    }

    // 6b. Delete guardian links
    const { error: linkDeleteError } = await supabase
      .from('student_guardians')
      .delete()
      .eq('student_id', studentId);

    if (linkDeleteError) {
      return errorResponse(
        `Failed to remove guardian links: ${linkDeleteError.message}`,
        500
      );
    }

    // 6c. Delete attendance records
    const { error: attendanceDeleteError } = await supabase
      .from('attendance')
      .delete()
      .eq('student_id', studentId);

    if (attendanceDeleteError) {
      return errorResponse(
        `Failed to remove attendance records: ${attendanceDeleteError.message}`,
        500
      );
    }

    // 6d. Delete disciplinary records
    const { error: disciplineDeleteError } = await supabase
      .from('disciplinary_records')
      .delete()
      .eq('student_id', studentId);

    if (disciplineDeleteError) {
      return errorResponse(
        `Failed to remove disciplinary records: ${disciplineDeleteError.message}`,
        500
      );
    }

    // 6e. Delete student fees
    const { error: feesDeleteError } = await supabase
      .from('student_fees')
      .delete()
      .eq('student_id', studentId);

    if (feesDeleteError) {
      return errorResponse(
        `Failed to remove fee records: ${feesDeleteError.message}`,
        500
      );
    }

    // 6f. Delete the student record
    const { error: deleteError } = await supabase
      .from('students')
      .delete()
      .eq('student_id', studentId)
      .eq('school_id', schoolId);

    if (deleteError) {
      return errorResponse(
        `Failed to delete student: ${deleteError.message}`,
        500
      );
    }

    return successResponse(
      {
        student_id: studentId,
        name: `${existingStudent.first_name} ${existingStudent.last_name}`,
        action: 'permanently_deleted',
      },
      'Student permanently deleted'
    );
  }

  // 7. Soft delete — set status to 'inactive'
  if (existingStudent.status === 'inactive') {
    return errorResponse('Student is already deactivated', 400);
  }

  const { data: deactivatedStudent, error: deactivateError } = await supabase
    .from('students')
    .update({
      status: 'inactive',
      updated_at: new Date().toISOString(),
    })
    .eq('student_id', studentId)
    .eq('school_id', schoolId)
    .select('student_id, first_name, last_name, status, updated_at')
    .single();

  if (deactivateError) {
    return errorResponse(
      `Failed to deactivate student: ${deactivateError.message}`,
      500
    );
  }

  return successResponse(
    {
      student: deactivatedStudent,
      action: 'deactivated',
    },
    `Student "${existingStudent.first_name} ${existingStudent.last_name}" has been deactivated`
  );
}
