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

const createDisciplineRecordSchema = z.object({
  student_id: z.string().uuid('Invalid student ID'),
  incident_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Incident date must be in YYYY-MM-DD format'),
  incident_type: z
    .string()
    .min(1, 'Incident type is required')
    .max(100, 'Incident type must be 100 characters or fewer')
    .trim(),
  description: z
    .string()
    .min(1, 'Description is required')
    .max(2000, 'Description must be 2000 characters or fewer')
    .trim(),
  severity: z.enum(['minor', 'moderate', 'major', 'severe'], {
    errorMap: () => ({
      message: 'Severity must be minor, moderate, major, or severe',
    }),
  }),
  location: z
    .string()
    .max(200, 'Location must be 200 characters or fewer')
    .trim()
    .optional()
    .nullable(),
  witnesses: z
    .string()
    .max(500, 'Witnesses must be 500 characters or fewer')
    .trim()
    .optional()
    .nullable(),
  action_taken: z
    .string()
    .max(1000, 'Action taken must be 1000 characters or fewer')
    .trim()
    .optional()
    .nullable(),
  parent_notified: z.boolean().default(false),
  parent_notification_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Parent notification date must be in YYYY-MM-DD format')
    .optional()
    .nullable(),
  follow_up_required: z.boolean().default(false),
  follow_up_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Follow up date must be in YYYY-MM-DD format')
    .optional()
    .nullable(),
  follow_up_notes: z
    .string()
    .max(1000, 'Follow up notes must be 1000 characters or fewer')
    .trim()
    .optional()
    .nullable(),
  status: z
    .enum(['open', 'in_progress', 'resolved', 'escalated'], {
      errorMap: () => ({
        message: 'Status must be open, in_progress, resolved, or escalated',
      }),
    })
    .default('open'),
});

// ─── Auth Helper ──────────────────────────────────────────────────────────────

interface AuthResult {
  userId: string;
  schoolId: string;
  roleName: string;
}

async function authenticate(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  allowedRoles: string[]
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

  if (!allowedRoles.includes(roleName)) {
    return { error: errorResponse('Insufficient permissions', 403) };
  }

  return {
    auth: {
      userId: user.user_id,
      schoolId: user.school_id,
      roleName,
    },
  };
}

// ─── GET /api/discipline ──────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const supabase = await createSupabaseServerClient();

  // 1. Auth — staff and admin roles can view discipline records
  const readRoles = [
    'super_admin',
    'school_admin',
    'principal',
    'deputy_principal',
    'teacher',
    'class_teacher',
    'ict_admin',
  ];

  const result = await authenticate(supabase, readRoles);
  if ('error' in result) return result.error;
  const { schoolId, roleName, userId } = result.auth;

  // 2. Parse query params
  const { searchParams } = new URL(req.url);
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10));
  const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get('page_size') ?? '20', 10)));
  const studentId = searchParams.get('student_id') ?? '';
  const classId = searchParams.get('class_id') ?? '';
  const severity = searchParams.get('severity') ?? '';
  const status = searchParams.get('status') ?? '';
  const dateFrom = searchParams.get('date_from') ?? '';
  const dateTo = searchParams.get('date_to') ?? '';
  const incidentType = searchParams.get('incident_type') ?? '';
  const search = searchParams.get('search')?.trim() ?? '';

  const offset = (page - 1) * pageSize;

  // 3. Build query
  let query = supabase
    .from('disciplinary_records')
    .select(
      `
      *,
      students (
        student_id,
        first_name,
        last_name,
        admission_number,
        photo_url,
        current_class_id,
        classes ( name, stream )
      ),
      reported_by_user:users!reported_by (
        user_id,
        email
      )
    `,
      { count: 'exact' }
    )
    .eq('school_id', schoolId)
    .order('incident_date', { ascending: false });

  // 4. Role-based scoping for class teachers
  if (roleName === 'class_teacher') {
    // Get classes assigned to this teacher
    const { data: teacherClasses } = await supabase
      .from('classes')
      .select('class_id')
      .eq('school_id', schoolId)
      .eq('class_teacher_id', userId);

    const teacherClassIds = (teacherClasses ?? []).map((c) => c.class_id);

    if (teacherClassIds.length > 0) {
      // Get students in teacher's classes
      const { data: classStudents } = await supabase
        .from('students')
        .select('student_id')
        .in('current_class_id', teacherClassIds);

      const studentIds = (classStudents ?? []).map((s) => s.student_id);

      if (studentIds.length > 0) {
        query = query.in('student_id', studentIds);
      } else {
        return successResponse(
          { records: [], total: 0, page, page_size: pageSize, total_pages: 0 },
          'No students in your assigned classes'
        );
      }
    } else {
      return successResponse(
        { records: [], total: 0, page, page_size: pageSize, total_pages: 0 },
        'No classes assigned to you'
      );
    }
  }

  // 5. Apply filters
  if (studentId) {
    query = query.eq('student_id', studentId);
  }

  if (classId) {
    // Get students in this class
    const { data: classStudents } = await supabase
      .from('students')
      .select('student_id')
      .eq('current_class_id', classId);

    const studentIds = (classStudents ?? []).map((s) => s.student_id);

    if (studentIds.length === 0) {
      return successResponse(
        { records: [], total: 0, page, page_size: pageSize, total_pages: 0 },
        'No students found in this class'
      );
    }

    query = query.in('student_id', studentIds);
  }

  if (severity) {
    query = query.eq('severity', severity);
  }

  if (status) {
    query = query.eq('status', status);
  }

  if (dateFrom) {
    query = query.gte('incident_date', dateFrom);
  }

  if (dateTo) {
    query = query.lte('incident_date', dateTo);
  }

  if (incidentType) {
    query = query.ilike('incident_type', `%${incidentType}%`);
  }

  if (search) {
    query = query.or(`description.ilike.%${search}%,incident_type.ilike.%${search}%`);
  }

  // 6. Apply pagination
  query = query.range(offset, offset + pageSize - 1);

  // 7. Execute query
  const { data: records, count, error } = await query;

  if (error) {
    return errorResponse(`Failed to fetch disciplinary records: ${error.message}`, 500);
  }

  const totalCount = count ?? 0;
  const totalPages = Math.ceil(totalCount / pageSize);

  // 8. Transform response
  const transformedRecords = (records ?? []).map((record) => {
    const student = record.students as Record<string, unknown> | null;
    const studentClass = (student?.classes as Record<string, unknown>) ?? null;
    const reporter = record.reported_by_user as Record<string, unknown> | null;

    return {
      ...record,
      students: undefined,
      reported_by_user: undefined,
      student: student
        ? {
            student_id: student.student_id,
            name: `${student.first_name} ${student.last_name}`,
            admission_number: student.admission_number,
            photo_url: student.photo_url,
            class_name: studentClass
              ? `${studentClass.name}${studentClass.stream ? ` ${studentClass.stream}` : ''}`
              : null,
          }
        : null,
      reported_by_email: reporter?.email ?? null,
    };
  });

  // 9. Calculate summary stats
  let statsQuery = supabase
    .from('disciplinary_records')
    .select('severity, status')
    .eq('school_id', schoolId);

  // Apply same scoping for class teachers
  if (roleName === 'class_teacher') {
    const { data: teacherClasses } = await supabase
      .from('classes')
      .select('class_id')
      .eq('school_id', schoolId)
      .eq('class_teacher_id', userId);

    const teacherClassIds = (teacherClasses ?? []).map((c) => c.class_id);

    if (teacherClassIds.length > 0) {
      const { data: classStudents } = await supabase
        .from('students')
        .select('student_id')
        .in('current_class_id', teacherClassIds);

      const studentIds = (classStudents ?? []).map((s) => s.student_id);
      if (studentIds.length > 0) {
        statsQuery = statsQuery.in('student_id', studentIds);
      }
    }
  }

  const { data: allRecords } = await statsQuery;

  const summary = {
    total: (allRecords ?? []).length,
    by_severity: {
      minor: (allRecords ?? []).filter((r) => r.severity === 'minor').length,
      moderate: (allRecords ?? []).filter((r) => r.severity === 'moderate').length,
      major: (allRecords ?? []).filter((r) => r.severity === 'major').length,
      severe: (allRecords ?? []).filter((r) => r.severity === 'severe').length,
    },
    by_status: {
      open: (allRecords ?? []).filter((r) => r.status === 'open').length,
      in_progress: (allRecords ?? []).filter((r) => r.status === 'in_progress').length,
      resolved: (allRecords ?? []).filter((r) => r.status === 'resolved').length,
      escalated: (allRecords ?? []).filter((r) => r.status === 'escalated').length,
    },
  };

  return successResponse(
    {
      records: transformedRecords,
      total: totalCount,
      page,
      page_size: pageSize,
      total_pages: totalPages,
      summary,
    },
    `Retrieved ${transformedRecords.length} disciplinary record(s)`
  );
}

// ─── POST /api/discipline ─────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const supabase = await createSupabaseServerClient();

  // 1. Auth — teachers and admin can create discipline records
  const writeRoles = [
    'super_admin',
    'school_admin',
    'principal',
    'deputy_principal',
    'teacher',
    'class_teacher',
    'subject_teacher',
    'ict_admin',
  ];

  const result = await authenticate(supabase, writeRoles);
  if ('error' in result) return result.error;
  const { schoolId, userId } = result.auth;

  // 2. Parse and validate request body
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return errorResponse('Invalid JSON body', 400);
  }

  const parsed = createDisciplineRecordSchema.safeParse(body);
  if (!parsed.success) {
    const fieldErrors = parsed.error.errors.map((e) => ({
      field: e.path.join('.'),
      message: e.message,
    }));
    return NextResponse.json(
      { success: false, message: 'Validation failed', data: null, errors: fieldErrors },
      { status: 400 }
    );
  }

  const data = parsed.data;

  // 3. Validate incident date is not in the future
  const incidentDate = new Date(data.incident_date);
  if (incidentDate > new Date()) {
    return errorResponse('Incident date cannot be in the future', 400);
  }

  // 4. Verify student exists and belongs to this school
  const { data: student } = await supabase
    .from('students')
    .select('student_id, first_name, last_name, current_class_id')
    .eq('student_id', data.student_id)
    .eq('school_id', schoolId)
    .maybeSingle();

  if (!student) {
    return errorResponse('Student not found or does not belong to this school', 404);
  }

  // 5. Validate parent_notification_date if provided
  if (data.parent_notified && data.parent_notification_date) {
    const notificationDate = new Date(data.parent_notification_date);
    if (notificationDate < incidentDate) {
      return errorResponse('Parent notification date cannot be before incident date', 400);
    }
  }

  // 6. Validate follow_up_date if provided
  if (data.follow_up_required && data.follow_up_date) {
    const followUpDate = new Date(data.follow_up_date);
    if (followUpDate < incidentDate) {
      return errorResponse('Follow up date cannot be before incident date', 400);
    }
  }

  // 7. Insert disciplinary record
  const timestamp = new Date().toISOString();

  const { data: newRecord, error: insertError } = await supabase
    .from('disciplinary_records')
    .insert({
      student_id: data.student_id,
      incident_date: data.incident_date,
      incident_type: data.incident_type,
      description: data.description,
      severity: data.severity,
      location: data.location ?? null,
      witnesses: data.witnesses ?? null,
      action_taken: data.action_taken ?? null,
      parent_notified: data.parent_notified,
      parent_notification_date: data.parent_notification_date ?? null,
      follow_up_required: data.follow_up_required,
      follow_up_date: data.follow_up_date ?? null,
      follow_up_notes: data.follow_up_notes ?? null,
      status: data.status,
      reported_by: userId,
      school_id: schoolId,
      created_at: timestamp,
      updated_at: timestamp,
    })
    .select(
      `
      *,
      students (
        student_id,
        first_name,
        last_name,
        admission_number,
        classes ( name, stream )
      )
    `
    )
    .single();

  if (insertError) {
    return errorResponse(`Failed to create disciplinary record: ${insertError.message}`, 500);
  }

  // 8. Transform response
  const studentData = newRecord.students as Record<string, unknown> | null;
  const studentClass = (studentData?.classes as Record<string, unknown>) ?? null;

  const response = {
    ...newRecord,
    students: undefined,
    student: studentData
      ? {
          student_id: studentData.student_id,
          name: `${studentData.first_name} ${studentData.last_name}`,
          admission_number: studentData.admission_number,
          class_name: studentClass
            ? `${studentClass.name}${studentClass.stream ? ` ${studentClass.stream}` : ''}`
            : null,
        }
      : null,
  };

  return successResponse(
    { record: response },
    `Disciplinary record created for ${student.first_name} ${student.last_name}`,
    201
  );
}
