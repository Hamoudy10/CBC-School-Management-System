// features/staff/validators/staff.schema.ts
// ============================================================
// Staff Module — Zod Validation Schemas
// Covers: Staff CRUD, Leave Management, Subject Assignments
// Maps to: staff, staff_leaves, teacher_subjects tables
// ============================================================

import { z } from 'zod';

// ============================================================
// Shared Enum Schemas
// ============================================================

export const staffPositionSchema = z.enum([
  'principal',
  'deputy_principal',
  'class_teacher',
  'subject_teacher',
  'finance_officer',
  'bursar',
  'librarian',
  'ict_admin',
  'admin_staff',
  'support_staff',
]);

export const staffStatusSchema = z.enum([
  'active',
  'inactive',
  'suspended',
  'archived',
]);

export const contractTypeSchema = z.enum([
  'permanent',
  'contract',
  'intern',
]);

export const leaveTypeSchema = z.enum([
  'sick',
  'annual',
  'maternity',
  'paternity',
  'compassionate',
]);

export const leaveStatusSchema = z.enum([
  'pending',
  'approved',
  'rejected',
  'cancelled',
]);

// ============================================================
// Date Helpers
// ============================================================
const dateStringSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format');

// ============================================================
// STAFF CRUD SCHEMAS
// ============================================================

/** POST /api/staff — Create a new staff record */
export const createStaffSchema = z.object({
  // User identity fields (creates a user + staff record)
  firstName: z
    .string()
    .min(1, 'First name is required')
    .max(100, 'First name must be 100 characters or less'),
  lastName: z
    .string()
    .min(1, 'Last name is required')
    .max(100, 'Last name must be 100 characters or less'),
  middleName: z
    .string()
    .max(100, 'Middle name must be 100 characters or less')
    .optional(),
  email: z
    .string()
    .email('Valid email is required')
    .max(255, 'Email must be 255 characters or less'),
  phone: z
    .string()
    .max(20, 'Phone must be 20 characters or less')
    .optional(),
  gender: z.enum(['male', 'female', 'other']).optional(),

  // Role assignment (must be a valid role_id for a staff-eligible role)
  roleId: z.string().uuid('Valid role ID is required'),

  // Staff-specific fields
  tscNumber: z
    .string()
    .max(50, 'TSC number must be 50 characters or less')
    .optional(),
  position: staffPositionSchema,
  employmentDate: dateStringSchema.optional(),
  contractType: contractTypeSchema.optional(),
  qualification: z
    .string()
    .max(1000, 'Qualification must be 1000 characters or less')
    .optional(),

  // Optional profile photo URL
  photoUrl: z.string().url('Photo URL must be a valid URL').optional(),

  // Password for the new user account
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .max(72, 'Password must be 72 characters or less'),
});

/** PUT /api/staff/[id] — Update an existing staff record */
export const updateStaffSchema = z.object({
  // User fields (optional updates)
  firstName: z
    .string()
    .min(1, 'First name is required')
    .max(100)
    .optional(),
  lastName: z
    .string()
    .min(1, 'Last name is required')
    .max(100)
    .optional(),
  middleName: z.string().max(100).optional().nullable(),
  phone: z.string().max(20).optional().nullable(),
  gender: z.enum(['male', 'female', 'other']).optional(),
  roleId: z.string().uuid().optional(),

  // Staff fields (optional updates)
  tscNumber: z.string().max(50).optional().nullable(),
  position: staffPositionSchema.optional(),
  employmentDate: dateStringSchema.optional().nullable(),
  contractType: contractTypeSchema.optional().nullable(),
  qualification: z.string().max(1000).optional().nullable(),
  status: staffStatusSchema.optional(),

  // Optional profile photo URL
  photoUrl: z.string().url().optional().nullable(),
});

// ============================================================
// STAFF LIST / FILTER SCHEMAS
// ============================================================

/** GET /api/staff — Query parameters for listing staff */
export const staffListFiltersSchema = z.object({
  search: z.string().optional(),
  position: staffPositionSchema.optional(),
  status: staffStatusSchema.optional(),
  contractType: contractTypeSchema.optional(),
  schoolId: z.string().uuid().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(200).default(20),
  sortBy: z
    .enum([
      'first_name',
      'last_name',
      'position',
      'employment_date',
      'status',
      'created_at',
    ])
    .default('created_at'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

// ============================================================
// STAFF LEAVE SCHEMAS
// ============================================================

/** POST /api/staff/[id]/leaves — Submit a leave request */
export const createLeaveSchema = z
  .object({
    leaveType: leaveTypeSchema,
    startDate: dateStringSchema,
    endDate: dateStringSchema,
    reason: z
      .string()
      .max(1000, 'Reason must be 1000 characters or less')
      .optional(),
  })
  .refine(
    (data) => new Date(data.endDate) >= new Date(data.startDate),
    {
      message: 'End date must be on or after start date',
      path: ['endDate'],
    },
  );

/** PATCH /api/staff/[id]/leaves/[leaveId] — Approve/reject a leave */
export const updateLeaveStatusSchema = z.object({
  status: z.enum(['approved', 'rejected', 'cancelled']),
});

/** GET /api/staff/[id]/leaves — Query parameters for listing leaves */
export const leaveListFiltersSchema = z.object({
  staffId: z.string().uuid().optional(),
  leaveType: leaveTypeSchema.optional(),
  status: leaveStatusSchema.optional(),
  startDate: dateStringSchema.optional(),
  endDate: dateStringSchema.optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

// ============================================================
// TEACHER SUBJECT ASSIGNMENT SCHEMAS
// ============================================================

/** POST /api/staff/[id]/assignments — Assign a subject to a teacher */
export const createAssignmentSchema = z.object({
  learningAreaId: z.string().uuid('Valid learning area ID is required'),
  classId: z.string().uuid('Valid class ID is required'),
  academicYearId: z.string().uuid('Valid academic year ID is required'),
  termId: z.string().uuid('Valid term ID is required'),
});

/** Bulk assign multiple subjects at once */
export const bulkAssignmentSchema = z.object({
  assignments: z
    .array(createAssignmentSchema)
    .min(1, 'At least one assignment is required')
    .max(20, 'Cannot assign more than 20 subjects at once'),
});

// ============================================================
// Inferred Types (for service layer consumption)
// ============================================================

export type CreateStaffInput = z.infer<typeof createStaffSchema>;
export type UpdateStaffInput = z.infer<typeof updateStaffSchema>;
export type StaffListFiltersInput = z.infer<typeof staffListFiltersSchema>;
export type CreateLeaveInput = z.infer<typeof createLeaveSchema>;
export type UpdateLeaveStatusInput = z.infer<typeof updateLeaveStatusSchema>;
export type LeaveListFiltersInput = z.infer<typeof leaveListFiltersSchema>;
export type CreateAssignmentInput = z.infer<typeof createAssignmentSchema>;
export type BulkAssignmentInput = z.infer<typeof bulkAssignmentSchema>;
