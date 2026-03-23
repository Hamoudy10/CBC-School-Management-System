// app/api/attendance/import/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { resolveAttendanceContext } from '@/features/attendance/services/attendance.service';
import * as XLSX from 'xlsx';
import { parse } from 'csv-parse/sync';
import { z } from 'zod';

// ─── Response Helpers ─────────────────────────────────────────────────────────
function successResponse(data: unknown, message: string, status: number = 200) {
  return NextResponse.json({ success: true, message, data }, { status });
}

function errorResponse(message: string, status: number = 400) {
  return NextResponse.json({ success: false, message, data: null }, { status });
}

// ─── Validation Schemas ───────────────────────────────────────────────────────
const attendanceImportSchema = z.object({
  admission_number: z
    .string()
    .min(1, 'Admission number is required')
    .max(50, 'Admission number must be 50 characters or fewer')
    .trim()
    .transform(val => val.toUpperCase()),
  status: z.enum(['present', 'absent', 'late', 'excused'], {
    errorMap: () => ({ message: 'Status must be present, absent, late, or excused' }),
  }),
  arrival_time: z
    .string()
    .regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/, 'Arrival time must be in HH:MM format (24-hour)')
    .optional()
    .nullable()
    .default(null),
  reason: z.string().max(500).trim().optional().nullable().default(null),
});

type AttendanceImportData = z.infer<typeof attendanceImportSchema>;

interface ValidationError {
  row: number;
  admissionNumber: string;
  error: string;
}

interface ImportResult {
  totalRecords: number;
  successfulImports: number;
  failedImports: number;
  errors: ValidationError[];
}

// ─── File Parsing Functions ───────────────────────────────────────────────────
function parseCSVFile(buffer: Buffer): any[] {
  try {
    const content = buffer.toString('utf-8');
    const records = parse(content, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
      bom: true,
    });
    return records;
  } catch (error) {
    throw new Error(`Failed to parse CSV file: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

function parseExcelFile(buffer: Buffer): any[] {
  try {
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const records = XLSX.utils.sheet_to_json(worksheet);
    return records;
  } catch (error) {
    throw new Error(`Failed to parse Excel file: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

function normalizeHeaders(headers: string[]): Record<string, string> {
  const headerMap: Record<string, string> = {};
  const standardHeaders = [
    'admission_number', 'status', 'arrival_time', 'reason'
  ];

  headers.forEach(header => {
    if (!header) {return;}
    
    const normalized = header
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '_')
      .replace(/_+/g, '_')
      .replace(/^_|_$/g, '');
    
    // Map common variations
    const mapping: Record<string, string> = {
      'admission_no': 'admission_number',
      'adm_no': 'admission_number',
      'student_no': 'admission_number',
      'time': 'arrival_time',
      'arrival': 'arrival_time',
      'remarks': 'reason',
      'note': 'reason',
    };

    headerMap[header] = mapping[normalized] || normalized;
  });

  return headerMap;
}

function normalizeRecord(record: any, headerMap: Record<string, string>): any {
  const normalized: any = {};
  
  Object.keys(record).forEach(key => {
    if (!key || !headerMap[key]) {return;}
    
    const normalizedKey = headerMap[key];
    let value = record[key];
    
    // Convert to string and trim
    if (value !== null && value !== undefined) {
      value = String(value).trim();
      if (value === '') {value = null;}
    }
    
    // Special handling for certain fields
    if (normalizedKey === 'status' && value) {
      value = value.toLowerCase();
      if (!['present', 'absent', 'late', 'excused'].includes(value)) {
        value = null;
      }
    }
    
    if (normalizedKey === 'arrival_time' && value) {
      // Normalize time format
      const timeRegex = /^(\d{1,2})[:.]?(\d{2})?\s?(am|pm)?$/i;
      const match = value.match(timeRegex);
      if (match) {
        let hours = parseInt(match[1], 10);
        const minutes = match[2] ? parseInt(match[2], 10) : 0;
        const period = match[3]?.toLowerCase();
        
        if (period === 'pm' && hours < 12) {hours += 12;}
        if (period === 'am' && hours === 12) {hours = 0;}
        
        value = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
      }
    }
    
    normalized[normalizedKey] = value;
  });
  
  return normalized;
}

// ─── Validation Functions ─────────────────────────────────────────────────────
async function validateAttendanceData(
  records: any[],
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  schoolId: string,
  classId: string,
  date: string
): Promise<{ validRecords: AttendanceImportData[]; errors: ValidationError[] }> {
  const errors: ValidationError[] = [];
  const validRecords: AttendanceImportData[] = [];

  // Get students in the selected class
  const { data: classStudents } = await supabase
    .from('students')
    .select('student_id, admission_number')
    .eq('school_id', schoolId)
    .eq('current_class_id', classId)
    .eq('status', 'active');

  const studentMap = new Map(
    classStudents?.map(s => [s.admission_number.toUpperCase(), s.student_id]) || []
  );

  // Check for existing attendance on this date
  const { data: existingAttendance } = await supabase
    .from('attendance')
    .select('student_id')
    .eq('school_id', schoolId)
    .eq('class_id', classId)
    .eq('date', date);

  const existingStudentIds = new Set(existingAttendance?.map(a => a.student_id) || []);

  for (let i = 0; i < records.length; i++) {
    const rowNumber = i + 2; // +2 because header row is row 1
    const record = records[i];

    try {
      // Validate against schema
      const validation = attendanceImportSchema.safeParse(record);
      
      if (!validation.success) {
        const firstError = validation.error.errors[0];
        errors.push({
          row: rowNumber,
          admissionNumber: record.admission_number || 'Unknown',
          error: firstError.message,
        });
        continue;
      }

      const data = validation.data;

      // Check if student exists in the class
      const studentId = studentMap.get(data.admission_number);
      if (!studentId) {
        errors.push({
          row: rowNumber,
          admissionNumber: data.admission_number,
          error: 'Student not found in selected class',
        });
        continue;
      }

      // Check for duplicate attendance
      if (existingStudentIds.has(studentId)) {
        errors.push({
          row: rowNumber,
          admissionNumber: data.admission_number,
          error: 'Attendance already recorded for this date',
        });
        continue;
      }

      // Validate arrival time for present/late status
      if ((data.status === 'present' || data.status === 'late') && !data.arrival_time) {
        errors.push({
          row: rowNumber,
          admissionNumber: data.admission_number,
          error: 'Arrival time required for present/late status',
        });
        continue;
      }

      // Validate reason for absent/excused status
      if ((data.status === 'absent' || data.status === 'excused') && !data.reason) {
        errors.push({
          row: rowNumber,
          admissionNumber: data.admission_number,
          error: 'Reason recommended for absent/excused status',
        });
        // Continue anyway, reason is optional but recommended
      }

      validRecords.push(data);
    } catch (error) {
      errors.push({
        row: rowNumber,
        admissionNumber: record.admission_number || 'Unknown',
        error: error instanceof Error ? error.message : 'Validation error',
      });
    }
  }

  return { validRecords, errors };
}

// ─── Import Functions ─────────────────────────────────────────────────────────
async function processAttendanceImport(
  validRecords: AttendanceImportData[],
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  schoolId: string,
  classId: string,
  date: string,
  userId: string,
  termId: string,
): Promise<ImportResult> {
  const result: ImportResult = {
    totalRecords: validRecords.length,
    successfulImports: 0,
    failedImports: 0,
    errors: [],
  };

  // Get student mapping
  const { data: classStudents } = await supabase
    .from('students')
    .select('student_id, admission_number')
    .eq('school_id', schoolId)
    .eq('current_class_id', classId);

  const studentMap = new Map(
    classStudents?.map(s => [s.admission_number.toUpperCase(), s.student_id]) || []
  );

  // Process in batches of 50
  const batchSize = 50;
  for (let i = 0; i < validRecords.length; i += batchSize) {
    const batch = validRecords.slice(i, i + batchSize);
    const attendanceRecords = [];

    for (const record of batch) {
      const studentId = studentMap.get(record.admission_number);
      if (!studentId) {
        result.failedImports++;
        result.errors.push({
          row: i + batch.indexOf(record) + 2,
          admissionNumber: record.admission_number,
          error: 'Student not found during import',
        });
        continue;
      }

      attendanceRecords.push({
        school_id: schoolId,
        student_id: studentId,
        class_id: classId,
        term_id: termId,
        date,
        status: record.status,
        arrival_time: record.arrival_time,
        reason: record.reason,
        recorded_by: userId,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
    }

    if (attendanceRecords.length > 0) {
      const { error } = await supabase
        .from('attendance')
        .insert(attendanceRecords);

      if (error) {
        result.failedImports += attendanceRecords.length;
        result.errors.push({
          row: i + 2,
          admissionNumber: 'Batch',
          error: `Database error: ${error.message}`,
        });
      } else {
        result.successfulImports += attendanceRecords.length;
      }
    }
  }

  return result;
}

// ─── Auth Helper ──────────────────────────────────────────────────────────────
async function authenticateAndAuthorize(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>
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

  const userRoles = user.roles as { name: string } | { name: string }[] | null;
  const roleName = Array.isArray(userRoles) 
    ? userRoles[0]?.name ?? 'student'
    : userRoles?.name ?? 'student';
  const allowedRoles = [
    'super_admin',
    'school_admin',
    'principal',
    'deputy_principal',
    'teacher',
    'class_teacher',
    'ict_admin',
  ];

  if (!allowedRoles.includes(roleName)) {
    return { error: errorResponse('Insufficient permissions', 403) };
  }

  return {
    user,
    roleName,
    schoolId: user.school_id,
    userId: authUser.id,
  };
}

// ─── POST /api/attendance/import ──────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const supabase = await createSupabaseServerClient();

  // 1. Authentication and authorization
  const auth = await authenticateAndAuthorize(supabase);
  if ('error' in auth && auth.error) {return auth.error;}

  const { schoolId, userId } = auth as {
    schoolId: string;
    userId: string;
  };

  // 2. Parse form data
  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return errorResponse('Invalid form data', 400);
  }

  const file = formData.get('file') as File;
  const classId = formData.get('classId') as string;
  const date = formData.get('date') as string;

  if (!file) {
    return errorResponse('No file uploaded', 400);
  }

  if (!classId) {
    return errorResponse('Class selection is required', 400);
  }

  if (!date) {
    return errorResponse('Date selection is required', 400);
  }

  // 3. Validate date is not in the future
  const today = new Date().toISOString().split('T')[0];
  if (date > today) {
    return errorResponse('Cannot record attendance for future dates', 400);
  }

  // 4. Validate class belongs to school
  const { data: validClass } = await supabase
    .from('classes')
    .select('class_id')
    .eq('class_id', classId)
    .eq('school_id', schoolId)
    .maybeSingle();

  if (!validClass) {
    return errorResponse('Selected class not found or does not belong to this school', 400);
  }

  const context = await resolveAttendanceContext(supabase, schoolId, date);
  if (!context.termId) {
    return errorResponse('No active term found for the selected date', 400);
  }

  // 5. Validate file type
  const validTypes = [
    'text/csv',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  ];
  
  if (!validTypes.includes(file.type) && !file.name.match(/\.(csv|xlsx|xls)$/i)) {
    return errorResponse('Invalid file type. Please upload CSV or Excel files.', 400);
  }

  // 6. Validate file size (max 5MB)
  if (file.size > 5 * 1024 * 1024) {
    return errorResponse('File size must be less than 5MB', 400);
  }

  try {
    // 7. Read and parse file
    const buffer = Buffer.from(await file.arrayBuffer());
    let records: any[];

    if (file.name.toLowerCase().endsWith('.csv')) {
      records = parseCSVFile(buffer);
    } else {
      records = parseExcelFile(buffer);
    }

    if (!records || records.length === 0) {
      return errorResponse('No data found in the file', 400);
    }

    // 8. Normalize headers and records
    const headers = Object.keys(records[0] || {});
    const headerMap = normalizeHeaders(headers);
    
    const normalizedRecords = records.map(record => 
      normalizeRecord(record, headerMap)
    );

    // 9. Validate data
    const { validRecords, errors } = await validateAttendanceData(
      normalizedRecords,
      supabase,
      schoolId,
      classId,
      date
    );

    if (errors.length > 0 && validRecords.length === 0) {
      return errorResponse(
        `All ${errors.length} records have validation errors`,
        400
      );
    }

    // 10. Process import
    const importResult = await processAttendanceImport(
      validRecords,
      supabase,
      schoolId,
      classId,
      date,
      userId,
      context.termId,
    );

    // Add validation errors to import result
    importResult.errors = [...errors, ...importResult.errors];
    importResult.failedImports += errors.length;

    return successResponse(
      {
        totalRecords: normalizedRecords.length,
        successfulImports: importResult.successfulImports,
        failedImports: importResult.failedImports,
        errors: importResult.errors,
      },
      `Successfully imported ${importResult.successfulImports} of ${normalizedRecords.length} attendance records`,
      201
    );

  } catch (error) {
    console.error('Attendance import error:', error);
    const message = error instanceof Error ? error.message : 'Failed to process import';
    return errorResponse(`Import failed: ${message}`, 500);
  }
}
