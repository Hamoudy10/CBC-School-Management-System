// features/staff/types.ts
// ============================================================
// Staff Module — TypeScript Definitions
// Maps to: staff, staff_leaves, teacher_subjects tables
// Covers: Staff records, leave management, subject assignments
// ============================================================

// ============================================================
// Database Enum Mappings
// ============================================================

/** Maps to staff_position enum in PostgreSQL */
export type StaffPosition =
  | 'principal'
  | 'deputy_principal'
  | 'class_teacher'
  | 'subject_teacher'
  | 'finance_officer'
  | 'bursar'
  | 'librarian'
  | 'ict_admin'
  | 'admin_staff'
  | 'support_staff';

/** Maps to user_status enum in PostgreSQL */
export type StaffStatus = 'active' | 'inactive' | 'suspended' | 'archived';

/** Contract types (stored as VARCHAR in DB) */
export type ContractType = 'permanent' | 'contract' | 'intern';

/** Leave types (stored as VARCHAR in DB) */
export type LeaveType =
  | 'sick'
  | 'annual'
  | 'maternity'
  | 'paternity'
  | 'compassionate';

/** Leave request status (stored as VARCHAR in DB) */
export type LeaveStatus = 'pending' | 'approved' | 'rejected' | 'cancelled';

// ============================================================
// Core Staff Types
// ============================================================

/** Full staff record — maps directly to the staff table */
export interface Staff {
  staffId: string;
  schoolId: string;
  userId: string;
  tscNumber: string | null;
  position: StaffPosition;
  employmentDate: string | null;
  contractType: ContractType | null;
  qualification: string | null;
  status: StaffStatus;
  createdAt: string;
  updatedAt: string;
  createdBy: string | null;
}

/** Staff record enriched with joined user details */
export interface StaffWithUser extends Staff {
  email: string;
  firstName: string;
  lastName: string;
  middleName: string | null;
  phone: string | null;
  gender: string | null;
  roleName: string;
}

/** Lightweight item for list/table views */
export interface StaffListItem {
  staffId: string;
  userId: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  gender: string | null;
  tscNumber: string | null;
  position: StaffPosition;
  contractType: ContractType | null;
  status: StaffStatus;
  employmentDate: string | null;
  roleName: string;
  createdAt: string;
}

/** Full detail view — includes profile info and summary counts */
export interface StaffDetail extends StaffWithUser {
  photoUrl: string | null;
  dateOfBirth: string | null;
  nationalId: string | null;
  address: string | null;
  emergencyContactName: string | null;
  emergencyContactPhone: string | null;
  activeLeaves: number;
  subjectAssignments: number;
}

// ============================================================
// Staff Leave Types
// ============================================================

/** Maps to staff_leaves table */
export interface StaffLeave {
  leaveId: string;
  schoolId: string;
  staffId: string;
  leaveType: LeaveType;
  startDate: string;
  endDate: string;
  reason: string | null;
  status: LeaveStatus;
  approvedBy: string | null;
  approvedAt: string | null;
  createdAt: string;
}

/** Leave record enriched with display names */
export interface StaffLeaveWithDetails extends StaffLeave {
  staffName: string;
  approverName: string | null;
  durationDays: number;
}

// ============================================================
// Teacher Subject Assignment Types
// ============================================================

/** Maps to teacher_subjects table */
export interface TeacherSubjectAssignment {
  id: string;
  schoolId: string;
  teacherId: string;
  learningAreaId: string;
  classId: string;
  academicYearId: string;
  termId: string;
  isActive: boolean;
  createdAt: string;
}

/** Assignment enriched with joined names for display */
export interface TeacherSubjectAssignmentWithDetails
  extends TeacherSubjectAssignment {
  teacherName: string;
  learningAreaName: string;
  className: string;
  termName: string;
  academicYear: string;
}

// ============================================================
// Pagination & Filter Types
// ============================================================

/** Generic paginated response wrapper */
export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

/** Staff list query filters */
export interface StaffListFilters {
  search?: string;
  position?: StaffPosition;
  status?: StaffStatus;
  contractType?: ContractType;
  schoolId?: string;
  page: number;
  pageSize: number;
  sortBy: string;
  sortOrder: 'asc' | 'desc';
}

/** Leave list query filters */
export interface LeaveListFilters {
  staffId?: string;
  leaveType?: LeaveType;
  status?: LeaveStatus;
  startDate?: string;
  endDate?: string;
  page: number;
  pageSize: number;
}

// ============================================================
// UI Display Label Maps
// ============================================================

export const STAFF_POSITION_LABELS: Record<StaffPosition, string> = {
  principal: 'Principal',
  deputy_principal: 'Deputy Principal',
  class_teacher: 'Class Teacher',
  subject_teacher: 'Subject Teacher',
  finance_officer: 'Finance Officer',
  bursar: 'Bursar',
  librarian: 'Librarian',
  ict_admin: 'ICT Admin',
  admin_staff: 'Admin Staff',
  support_staff: 'Support Staff',
};

export const CONTRACT_TYPE_LABELS: Record<ContractType, string> = {
  permanent: 'Permanent',
  contract: 'Contract',
  intern: 'Intern',
};

export const LEAVE_TYPE_LABELS: Record<LeaveType, string> = {
  sick: 'Sick Leave',
  annual: 'Annual Leave',
  maternity: 'Maternity Leave',
  paternity: 'Paternity Leave',
  compassionate: 'Compassionate Leave',
};

export const LEAVE_STATUS_LABELS: Record<LeaveStatus, string> = {
  pending: 'Pending',
  approved: 'Approved',
  rejected: 'Rejected',
  cancelled: 'Cancelled',
};

export const STAFF_STATUS_LABELS: Record<StaffStatus, string> = {
  active: 'Active',
  inactive: 'Inactive',
  suspended: 'Suspended',
  archived: 'Archived',
};