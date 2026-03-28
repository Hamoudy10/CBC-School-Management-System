// features/students/types.ts

import { Database } from '@/types/database.types';

// ─── Base Database Types ─────────────────────────────────────
export type StudentRow = Database['public']['Tables']['students']['Row'];
export type StudentInsert = Database['public']['Tables']['students']['Insert'];
export type StudentUpdate = Database['public']['Tables']['students']['Update'];

export type StudentGuardianRow = Database['public']['Tables']['student_guardians']['Row'];
export type StudentGuardianInsert = Database['public']['Tables']['student_guardians']['Insert'];

export type StudentClassRow = Database['public']['Tables']['student_classes']['Row'];
export type StudentClassInsert = Database['public']['Tables']['student_classes']['Insert'];

// ─── Enums ───────────────────────────────────────────────────
export type EnrollmentStatus = Database['public']['Enums']['enrollment_status'];
export type GenderType = Database['public']['Enums']['gender_type'];

export const ENROLLMENT_STATUSES: EnrollmentStatus[] = [
  'active',
  'transferred',
  'graduated',
  'withdrawn',
  'suspended',
];

export const GENDER_OPTIONS: { value: GenderType; label: string }[] = [
  { value: 'male', label: 'Male' },
  { value: 'female', label: 'Female' },
  { value: 'other', label: 'Other' },
];

export const ENROLLMENT_STATUS_OPTIONS: { value: EnrollmentStatus; label: string; color: string }[] = [
  { value: 'active', label: 'Active', color: 'green' },
  { value: 'transferred', label: 'Transferred', color: 'blue' },
  { value: 'graduated', label: 'Graduated', color: 'purple' },
  { value: 'withdrawn', label: 'Withdrawn', color: 'amber' },
  { value: 'suspended', label: 'Suspended', color: 'red' },
];

export const RELATIONSHIP_OPTIONS = [
  'father',
  'mother',
  'guardian',
  'grandparent',
  'uncle',
  'aunt',
  'sibling',
  'other',
] as const;

export type GuardianRelationship = (typeof RELATIONSHIP_OPTIONS)[number];

// ─── Student DTOs ────────────────────────────────────────────
export interface Student {
  studentId: string;
  schoolId: string;
  userId: string | null;
  admissionNumber: string;
  currentClassId: string | null;
  dateOfBirth: string;
  gender: GenderType;
  firstName: string;
  lastName: string;
  middleName: string | null;
  enrollmentDate: string;
  status: EnrollmentStatus;
  photoUrl: string | null;
  birthCertificateNo: string | null;
  nemisNumber: string | null;
  hasSpecialNeeds: boolean;
  specialNeedsDetails: string | null;
  medicalInfo: string | null;
  previousSchool: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface StudentWithDetails extends Student {
  fullName: string;
  age: number;
  currentClass: {
    classId: string;
    name: string;
    gradeName: string;
    stream: string | null;
  } | null;
  guardians: StudentGuardian[];
  feeBalance: number;
  attendanceRate: number | null;
}

export interface StudentGuardian {
  id: string;
  studentId: string;
  guardianUserId: string;
  relationship: string;
  isPrimaryContact: boolean;
  canPickup: boolean;
  createdAt: string;
  // Joined user details
  guardian: {
    userId: string;
    firstName: string;
    lastName: string;
    email: string;
    phone: string | null;
  } | null;
}

export interface StudentClassHistory {
  id: string;
  studentId: string;
  classId: string;
  academicYearId: string;
  termId: string;
  status: EnrollmentStatus;
  createdAt: string;
  // Joined details
  className: string;
  gradeName: string;
  academicYear: string;
  termName: string;
}

// ─── Create/Update DTOs ──────────────────────────────────────
export interface CreateStudentInput {
  firstName: string;
  lastName: string;
  middleName?: string;
  dateOfBirth: string;
  gender: GenderType;
  admissionNumber?: string; // Auto-generated if not provided
  enrollmentDate?: string;
  classId: string;
  photoUrl?: string;
  birthCertificateNo?: string;
  nemisNumber?: string;
  hasSpecialNeeds?: boolean;
  specialNeedsDetails?: string;
  medicalInfo?: string;
  previousSchool?: string;
  // Guardian info (optional, can add later)
  guardians?: CreateGuardianInput[];
}

export interface UpdateStudentInput {
  firstName?: string;
  lastName?: string;
  middleName?: string;
  dateOfBirth?: string;
  gender?: GenderType;
  currentClassId?: string;
  status?: EnrollmentStatus;
  photoUrl?: string;
  birthCertificateNo?: string;
  nemisNumber?: string;
  hasSpecialNeeds?: boolean;
  specialNeedsDetails?: string;
  medicalInfo?: string;
}

export interface CreateGuardianInput {
  guardianUserId?: string; // Existing user
  // Or create new user
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  relationship: GuardianRelationship;
  isPrimaryContact?: boolean;
  canPickup?: boolean;
}

export interface LinkGuardianInput {
  studentId: string;
  guardianUserId: string;
  relationship: GuardianRelationship;
  isPrimaryContact?: boolean;
  canPickup?: boolean;
}

export interface UpdateGuardianInput {
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  relationship?: GuardianRelationship;
  isPrimaryContact?: boolean;
  canPickup?: boolean;
}

// ─── Transfer/Promotion DTOs ─────────────────────────────────
export interface TransferStudentInput {
  studentId: string;
  toClassId: string;
  reason?: string;
  effectiveDate?: string;
}

export interface PromoteStudentsInput {
  studentIds: string[];
  fromClassId: string;
  toClassId: string;
  academicYearId: string;
  termId: string;
}

export interface BulkEnrollInput {
  classId: string;
  academicYearId: string;
  termId: string;
  students: CreateStudentInput[];
}

// ─── Query/Filter Types ──────────────────────────────────────
export interface StudentFilters {
  search?: string;
  classId?: string;
  gradeId?: string;
  status?: EnrollmentStatus;
  gender?: GenderType;
  hasSpecialNeeds?: boolean;
  academicYearId?: string;
  termId?: string;
}

export interface StudentQueryParams extends StudentFilters {
  page?: number;
  limit?: number;
  sortBy?: keyof Student;
  sortOrder?: 'asc' | 'desc';
}

export interface PaginatedStudents {
  data: StudentWithDetails[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// ─── Statistics Types ────────────────────────────────────────
export interface StudentStats {
  total: number;
  active: number;
  transferred: number;
  graduated: number;
  withdrawn: number;
  suspended: number;
  byGender: {
    male: number;
    female: number;
    other: number;
  };
  byGrade: {
    gradeId: string;
    gradeName: string;
    count: number;
  }[];
  withSpecialNeeds: number;
  newEnrollmentsThisTerm: number;
}

export interface StudentAttendanceSummary {
  studentId: string;
  termId: string;
  totalDays: number;
  presentDays: number;
  absentDays: number;
  lateDays: number;
  excusedDays: number;
  attendanceRate: number;
}

export interface StudentFeeSummary {
  studentId: string;
  academicYearId: string;
  termId?: string;
  totalDue: number;
  totalPaid: number;
  balance: number;
  status: 'paid' | 'partial' | 'pending' | 'overdue';
}

export interface StudentPerformanceSummary {
  studentId: string;
  termId: string;
  academicYearId: string;
  overallAverage: number;
  overallLevel: 'below_expectation' | 'approaching' | 'meeting' | 'exceeding';
  learningAreas: {
    learningAreaId: string;
    name: string;
    averageScore: number;
    level: string;
  }[];
}

// ─── Bulk Import Types ───────────────────────────────────────
export interface StudentImportRow {
  rowNumber: number;
  firstName: string;
  lastName: string;
  middleName?: string;
  dateOfBirth: string;
  gender: string;
  admissionNumber?: string;
  className: string;
  guardianName?: string;
  guardianPhone?: string;
  guardianEmail?: string;
  guardianRelationship?: string;
}

export interface StudentImportResult {
  success: boolean;
  totalRows: number;
  successCount: number;
  errorCount: number;
  errors: {
    rowNumber: number;
    field: string;
    message: string;
  }[];
  createdStudents: string[]; // IDs
}

// ─── API Response Types ──────────────────────────────────────
export interface StudentApiResponse {
  success: boolean;
  data: StudentWithDetails;
  message?: string;
}

export interface StudentsListApiResponse {
  success: boolean;
  data: PaginatedStudents;
  message?: string;
}

export interface StudentStatsApiResponse {
  success: boolean;
  data: StudentStats;
  message?: string;
}

// ─── Utility Functions ───────────────────────────────────────
export function calculateAge(dateOfBirth: string): number {
  const today = new Date();
  const birthDate = new Date(dateOfBirth);
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  return age;
}

export function getFullName(student: Pick<Student, 'firstName' | 'middleName' | 'lastName'>): string {
  const parts = [student.firstName, student.middleName, student.lastName].filter(Boolean);
  return parts.join(' ');
}

export function getStatusColor(status: EnrollmentStatus): string {
  const statusOption = ENROLLMENT_STATUS_OPTIONS.find((s) => s.value === status);
  return statusOption?.color ?? 'gray';
}

export function mapRowToStudent(row: StudentRow): Student {
  return {
    studentId: row.student_id,
    schoolId: row.school_id,
    userId: row.user_id,
    admissionNumber: row.admission_number,
    currentClassId: row.current_class_id,
    dateOfBirth: row.date_of_birth,
    gender: row.gender,
    firstName: row.first_name,
    lastName: row.last_name,
    middleName: row.middle_name,
    enrollmentDate: row.enrollment_date,
    status: row.status,
    photoUrl: row.photo_url,
    birthCertificateNo: row.birth_certificate_no,
    nemisNumber: row.nemis_number,
    hasSpecialNeeds: row.has_special_needs,
    specialNeedsDetails: row.special_needs_details,
    medicalInfo: row.medical_info,
    previousSchool: row.previous_school,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapStudentToInsert(input: CreateStudentInput, schoolId: string): StudentInsert {
  return {
    school_id: schoolId,
    first_name: input.firstName,
    last_name: input.lastName,
    middle_name: input.middleName ?? null,
    date_of_birth: input.dateOfBirth,
    gender: input.gender,
    admission_number: input.admissionNumber ?? '', // Will be generated
    enrollment_date: input.enrollmentDate ?? new Date().toISOString().split('T')[0],
    current_class_id: input.classId,
    photo_url: input.photoUrl ?? null,
    birth_certificate_no: input.birthCertificateNo ?? null,
    nemis_number: input.nemisNumber ?? null,
    has_special_needs: input.hasSpecialNeeds ?? false,
    special_needs_details: input.specialNeedsDetails ?? null,
    medical_info: input.medicalInfo ?? null,
    previous_school: input.previousSchool ?? null,
    status: 'active',
  };
}
