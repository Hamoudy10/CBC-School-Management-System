export const dynamic = 'force-dynamic';

// app/api/students/import/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import * as XLSX from 'xlsx';
import { parse } from 'csv-parse/sync';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';

// ─── Response Helpers ─────────────────────────────────────────────────────────
function successResponse(data: unknown, message: string, status: number = 200) {
  return NextResponse.json({ success: true, message, data }, { status });
}

function errorResponse(message: string, status: number = 400) {
  return NextResponse.json({ success: false, message, data: null }, { status });
}

// ─── Validation Schemas ───────────────────────────────────────────────────────
const studentImportSchema = z.object({
  admission_number: z
    .string()
    .min(1, 'Admission number is required')
    .max(50, 'Admission number must be 50 characters or fewer')
    .trim()
    .transform(val => val.toUpperCase()),
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
    .nullable()
    .default(null),
  date_of_birth: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date of birth must be in YYYY-MM-DD format')
    .refine(date => {
      const dob = new Date(date);
      const today = new Date();
      const age = today.getFullYear() - dob.getFullYear();
      const hasBirthdayPassed = today.getMonth() > dob.getMonth() || 
        (today.getMonth() === dob.getMonth() && today.getDate() >= dob.getDate());
      const actualAge = hasBirthdayPassed ? age : age - 1;
      return actualAge >= 3 && actualAge <= 25;
    }, 'Student age must be between 3 and 25 years'),
  gender: z.enum(['male', 'female', 'other'], {
    errorMap: () => ({ message: 'Gender must be male, female, or other' }),
  }),
  class_name: z.string().max(100).trim().optional().nullable().default(null),
  guardian_name: z.string().max(200).trim().optional().nullable().default(null),
  guardian_phone: z.string().max(15).trim().optional().nullable().default(null),
  guardian_email: z.string().email('Invalid email').optional().nullable().default(null),
  guardian_relationship: z.enum([
    'father', 'mother', 'guardian', 'uncle', 'aunt', 'grandparent', 'sibling', 'other'
  ]).optional().nullable().default('guardian'),
  medical_info: z.string().max(1000).optional().nullable().default(null),
  special_needs: z.string().max(1000).optional().nullable().default(null),
  previous_school: z.string().max(200).trim().optional().nullable().default(null),
  nationality: z.string().max(100).trim().optional().nullable().default('Kenyan'),
  religion: z.string().max(100).trim().optional().nullable().default(null),
  birth_certificate_no: z.string().max(50).trim().optional().nullable().default(null),
  nemis_number: z.string().max(50).trim().optional().nullable().default(null),
});

type StudentImportData = z.infer<typeof studentImportSchema>;

interface ValidationError {
  row: number;
  field: string;
  message: string;
  value?: string;
}

interface ImportResult {
  totalRecords: number;
  validRecords: number;
  errorCount: number;
  duplicateCount: number;
  records: Array<{
    rowNumber: number;
    status: 'valid' | 'error' | 'duplicate';
    data: Partial<StudentImportData>;
    errors?: string[];
  }>;
  errors: ValidationError[];
}

interface BulkImportResult {
  successfulImports: number;
  failedImports: number;
  totalRecords: number;
  duplicateEntries: number;
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
    'admission_number', 'first_name', 'last_name', 'middle_name', 'date_of_birth',
    'gender', 'class_name', 'guardian_name', 'guardian_phone', 'guardian_email',
    'guardian_relationship', 'medical_info', 'special_needs', 'previous_school',
    'nationality', 'religion', 'birth_certificate_no', 'nemis_number'
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
      'dob': 'date_of_birth',
      'birth_date': 'date_of_birth',
      'class': 'class_name',
      'grade': 'class_name',
      'parent_name': 'guardian_name',
      'parent_phone': 'guardian_phone',
      'parent_email': 'guardian_email',
      'parent_relationship': 'guardian_relationship',
      'health_info': 'medical_info',
      'medical': 'medical_info',
      'disability': 'special_needs',
      'old_school': 'previous_school',
      'birth_cert': 'birth_certificate_no',
      'nemis': 'nemis_number',
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
    if (normalizedKey === 'gender' && value) {
      value = value.toLowerCase();
      if (value === 'm' || value === 'male') {value = 'male';}
      if (value === 'f' || value === 'female') {value = 'female';}
      if (value !== 'male' && value !== 'female') {value = 'other';}
    }
    
    if (normalizedKey === 'date_of_birth' && value) {
      // Try to parse various date formats
      const date = new Date(value);
      if (!isNaN(date.getTime())) {
        value = date.toISOString().split('T')[0];
      }
    }
    
    normalized[normalizedKey] = value;
  });
  
  return normalized;
}

// ─── Validation Functions ─────────────────────────────────────────────────────
async function validateImportData(
  records: any[],
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  schoolId: string
): Promise<ImportResult> {
  const result: ImportResult = {
    totalRecords: records.length,
    validRecords: 0,
    errorCount: 0,
    duplicateCount: 0,
    records: [],
    errors: [],
  };

  // Get existing admission numbers for duplicate checking
  const { data: existingStudents } = await supabase
    .from('students')
    .select('admission_number, nemis_number')
    .eq('school_id', schoolId);

  const existingAdmissionNumbers = new Set(existingStudents?.map(s => s.admission_number.toLowerCase()) || []);
  const existingNemisNumbers = new Set(existingStudents?.map(s => s.nemis_number?.toLowerCase()).filter(Boolean) || []);

  // Get available classes for validation
  const { data: classes } = await supabase
    .from('classes')
    .select('class_id, name, stream')
    .eq('school_id', schoolId)
    .eq('is_active', true);

  const classMap = new Map();
  classes?.forEach(cls => {
    const key = cls.stream ? `${cls.name} ${cls.stream}`.toLowerCase() : cls.name.toLowerCase();
    classMap.set(key, cls.class_id);
  });

  for (let i = 0; i < records.length; i++) {
    const rowNumber = i + 2; // +2 because header row is row 1
    const record = records[i];
    const errors: ValidationError[] = [];

    try {
      // Check for duplicates
      const admissionNumber = record.admission_number?.toLowerCase();
      if (admissionNumber && existingAdmissionNumbers.has(admissionNumber)) {
        errors.push({
          row: rowNumber,
          field: 'admission_number',
          message: 'Admission number already exists in the system',
          value: record.admission_number,
        });
        result.duplicateCount++;
      }

      if (record.nemis_number && existingNemisNumbers.has(record.nemis_number.toLowerCase())) {
        errors.push({
          row: rowNumber,
          field: 'nemis_number',
          message: 'NEMIS number already exists in the system',
          value: record.nemis_number,
        });
        result.duplicateCount++;
      }

      // Validate against schema
      const validation = studentImportSchema.safeParse(record);
      
      if (!validation.success) {
        validation.error.errors.forEach(zodError => {
          const field = zodError.path.join('.');
          errors.push({
            row: rowNumber,
            field,
            message: zodError.message,
            value: record[field],
          });
        });
      }

      // Validate class if provided
      if (record.class_name) {
        const classNameKey = record.class_name.toLowerCase();
        if (!classMap.has(classNameKey)) {
          errors.push({
            row: rowNumber,
            field: 'class_name',
            message: 'Class not found or not active in the system',
            value: record.class_name,
          });
        }
      }

      // Validate guardian phone if provided
      if (record.guardian_phone) {
        const phoneRegex = /^[+]?[0-9\s\-()]{10,15}$/;
        if (!phoneRegex.test(record.guardian_phone)) {
          errors.push({
            row: rowNumber,
            field: 'guardian_phone',
            message: 'Invalid phone number format',
            value: record.guardian_phone,
          });
        }
      }

      if (errors.length === 0) {
        result.validRecords++;
        result.records.push({
          rowNumber,
          status: 'valid',
          data: validation.data as Partial<StudentImportData>,
        });
      } else {
        result.errorCount++;
        result.errors.push(...errors);
        result.records.push({
          rowNumber,
          status: 'error',
          data: record as Partial<StudentImportData>,
          errors: errors.map(e => `${e.field}: ${e.message}`),
        });
      }
          } catch (error) {
        result.errorCount++;
        const errorMsg = error instanceof Error ? error.message : 'Unknown validation error';
        errors.push({
          row: rowNumber,
          field: 'general',
          message: errorMsg,
        });
        result.errors.push(...errors);
        result.records.push({
          rowNumber,
          status: 'error',
          data: record as Partial<StudentImportData>,
          errors: [errorMsg],
        });
      }

    // Limit to 500 records
    if (records.length > 500) {
      errors.push({
        row: rowNumber,
        field: 'general',
        message: 'Maximum 500 records allowed per import',
      });
      break;
    }
  }

  return result;
}

// ─── Import Functions ─────────────────────────────────────────────────────────
async function processBulkImport(
  validRecords: StudentImportData[],
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  schoolId: string,
  userId: string
): Promise<BulkImportResult> {
  const result: BulkImportResult = {
    successfulImports: 0,
    failedImports: 0,
    totalRecords: validRecords.length,
    duplicateEntries: 0,
    errors: [],
  };

  // Get class mapping
  const { data: classes } = await supabase
    .from('classes')
    .select('class_id, name, stream')
    .eq('school_id', schoolId)
    .eq('is_active', true);

  const classMap = new Map();
  classes?.forEach(cls => {
    const key = cls.stream ? `${cls.name} ${cls.stream}`.toLowerCase() : cls.name.toLowerCase();
    classMap.set(key, cls.class_id);
  });

  // Process in batches of 50
  const batchSize = 50;
  for (let i = 0; i < validRecords.length; i += batchSize) {
    const batch = validRecords.slice(i, i + batchSize);
    const batchPromises = batch.map(async (record, batchIndex) => {
      const rowNumber = i + batchIndex + 2;
      
      try {
        // Check for duplicates again (in case of concurrent imports)
        const { data: existing } = await supabase
          .from('students')
          .select('student_id')
          .eq('school_id', schoolId)
          .eq('admission_number', record.admission_number)
          .maybeSingle();

        if (existing) {
          result.duplicateEntries++;
          result.errors.push({
            row: rowNumber,
            field: 'admission_number',
            message: 'Duplicate admission number detected during import',
            value: record.admission_number,
          });
          return null;
        }

        // Determine class ID
        let classId = null;
        if (record.class_name) {
          const classNameKey = record.class_name.toLowerCase();
          classId = classMap.get(classNameKey) || null;
        }

        // Create student record
        const studentData = {
          student_id: uuidv4(),
          school_id: schoolId,
          admission_number: record.admission_number,
          first_name: record.first_name,
          last_name: record.last_name,
          middle_name: record.middle_name,
          date_of_birth: record.date_of_birth,
          gender: record.gender,
          current_class_id: classId,
          enrollment_date: new Date().toISOString().split('T')[0],
          status: 'active',
          nemis_number: record.nemis_number,
          birth_certificate_no: record.birth_certificate_no,
          medical_info: record.medical_info,
          special_needs_details: record.special_needs,
          previous_school: record.previous_school,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          created_by: userId,
        };

        const { error: studentError } = await supabase
          .from('students')
          .insert(studentData);

        if (studentError) {
          throw new Error(`Database error: ${studentError.message}`);
        }

        // Create guardian if provided
        if (record.guardian_name || record.guardian_phone) {
          const guardianId = uuidv4();
          
          // Create guardian record
          const guardianData = {
            guardian_id: guardianId,
            school_id: schoolId,
            first_name: record.guardian_name?.split(' ')[0] || 'Guardian',
            last_name: record.guardian_name?.split(' ').slice(1).join(' ') || 'Unknown',
            phone_number: record.guardian_phone,
            email: record.guardian_email,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          };

          await supabase
            .from('guardians')
            .insert(guardianData);

          // Link guardian to student
          await supabase
            .from('student_guardians')
            .insert({
              student_id: studentData.student_id,
              guardian_id: guardianId,
              relationship: record.guardian_relationship || 'guardian',
              is_primary: true,
              created_at: new Date().toISOString(),
            });
        }

        return studentData.student_id;
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Unknown import error';
        result.errors.push({
          row: rowNumber,
          field: 'general',
          message: errorMsg,
        });
        return null;
      }
    });

    const batchResults = await Promise.all(batchPromises);
    const successful = batchResults.filter(id => id !== null);
    result.successfulImports += successful.length;
    result.failedImports += batchResults.length - successful.length;
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

// ─── POST /api/students/import ────────────────────────────────────────────────
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
  const action = formData.get('action') as string;

  if (!file) {
    return errorResponse('No file uploaded', 400);
  }

  if (!action || !['validate', 'import'].includes(action)) {
    return errorResponse('Invalid action specified', 400);
  }

  // 3. Validate file type
  const validTypes = [
    'text/csv',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  ];
  
  if (!validTypes.includes(file.type) && !file.name.match(/\.(csv|xlsx|xls)$/i)) {
    return errorResponse('Invalid file type. Please upload CSV or Excel files.', 400);
  }

  // 4. Validate file size (max 10MB)
  if (file.size > 10 * 1024 * 1024) {
    return errorResponse('File size must be less than 10MB', 400);
  }

  try {
    // 5. Read and parse file
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

    // 6. Normalize headers and records
    const headers = Object.keys(records[0] || {});
    const headerMap = normalizeHeaders(headers);
    
    const normalizedRecords = records.map(record => 
      normalizeRecord(record, headerMap)
    );

    // 7. Validate data
    const validationResult = await validateImportData(normalizedRecords, supabase, schoolId);

    if (action === 'validate') {
      return successResponse(
        {
          totalRecords: validationResult.totalRecords,
          validRecords: validationResult.validRecords,
          errorCount: validationResult.errorCount,
          duplicateCount: validationResult.duplicateCount,
          records: validationResult.records,
          errors: validationResult.errors,
        },
        validationResult.errorCount === 0 
          ? `All ${validationResult.validRecords} records are valid and ready for import`
          : `Found ${validationResult.errorCount} errors in ${validationResult.totalRecords} records`
      );
    }

    // 8. Process import
    if (validationResult.errorCount > 0) {
      return errorResponse(
        `Cannot import: ${validationResult.errorCount} validation errors found`,
        400
      );
    }

    if (validationResult.validRecords === 0) {
      return errorResponse('No valid records to import', 400);
    }

    const validData = validationResult.records
      .filter(r => r.status === 'valid')
      .map(r => r.data as StudentImportData);

    const importResult = await processBulkImport(validData, supabase, schoolId, userId);

    return successResponse(
      {
        successfulImports: importResult.successfulImports,
        failedImports: importResult.failedImports,
        totalRecords: importResult.totalRecords,
        duplicateEntries: importResult.duplicateEntries,
        errors: importResult.errors,
      },
      `Successfully imported ${importResult.successfulImports} of ${importResult.totalRecords} students`,
      201
    );

  } catch (error) {
    console.error('Import error:', error);
    const message = error instanceof Error ? error.message : 'Failed to process import';
    return errorResponse(`Import failed: ${message}`, 500);
  }
}

// ─── GET /api/students/import/template ───────────────────────────────────────
export async function GET(req: NextRequest) {
  const supabase = await createSupabaseServerClient();

  // Check authentication
  const auth = await authenticateAndAuthorize(supabase);
  if ('error' in auth && auth.error) {return auth.error;}

  // Create CSV template
  const headers = [
    'Admission Number',
    'First Name', 
    'Last Name',
    'Middle Name',
    'Date of Birth (YYYY-MM-DD)',
    'Gender (male/female/other)',
    'Class (e.g., Grade 4 A)',
    'Guardian Name',
    'Guardian Phone',
    'Guardian Email',
    'Guardian Relationship (father/mother/guardian/etc)',
    'Medical Info',
    'Special Needs',
    'Previous School',
    'Nationality',
    'Religion',
    'Birth Certificate No',
    'NEMIS Number',
  ];

  const sampleData = [
    'STU-2024-001',
    'John',
    'Doe',
    'Michael',
    '2015-05-15',
    'male',
    'Grade 4 A',
    'Jane Doe',
    '+254712345678',
    'jane@example.com',
    'mother',
    'Asthma - uses inhaler',
    'None',
    'St. Mary\'s Primary',
    'Kenyan',
    'Christian',
    'BC123456',
    'NEMIS-001',
  ];

  const csvContent = [
    headers.join(','),
    sampleData.join(','),
    '',
    'INSTRUCTIONS:',
    '1. Keep the header row as shown above',
    '2. Fill in student data in subsequent rows',
    '3. Required fields: Admission Number, First Name, Last Name, Date of Birth, Gender',
    '4. Date format must be YYYY-MM-DD',
    '5. Gender must be: male, female, or other',
    '6. Maximum 500 records per file',
    '7. Save file as CSV format',
  ].join('\n');

  return new NextResponse(csvContent, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': `attachment; filename="students-import-template-${new Date().toISOString().split('T')[0]}.csv"`,
    },
  });
}