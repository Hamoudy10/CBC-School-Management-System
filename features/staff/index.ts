// features/staff/index.ts
// ============================================================
// Staff Module — Public Entry Point
// Re-exports all public types, validators, and service functions
// Usage: import { listStaff, StaffListItem, createStaffSchema } from '@/features/staff'
// ============================================================

// ============================================================
// Types
// ============================================================
export type {
  // Enums
  StaffPosition,
  StaffStatus,
  ContractType,
  LeaveType,
  LeaveStatus,
  // Staff
  Staff,
  StaffWithUser,
  StaffListItem,
  StaffDetail,
  // Leaves
  StaffLeave,
  StaffLeaveWithDetails,
  // Assignments
  TeacherSubjectAssignment,
  TeacherSubjectAssignmentWithDetails,
  // Pagination & Filters
  PaginatedResponse,
  StaffListFilters,
  LeaveListFilters,
} from './types';

// Label maps (non-type exports)
export {
  STAFF_POSITION_LABELS,
  STAFF_STATUS_LABELS,
  CONTRACT_TYPE_LABELS,
  LEAVE_TYPE_LABELS,
  LEAVE_STATUS_LABELS,
} from './types';

// ============================================================
// Validators (Zod Schemas)
// ============================================================
export {
  // Enum schemas
  staffPositionSchema,
  staffStatusSchema,
  contractTypeSchema,
  leaveTypeSchema,
  leaveStatusSchema,
  // Staff CRUD
  createStaffSchema,
  updateStaffSchema,
  staffListFiltersSchema,
  // Leave management
  createLeaveSchema,
  updateLeaveStatusSchema,
  leaveListFiltersSchema,
  // Subject assignments
  createAssignmentSchema,
  bulkAssignmentSchema,
} from './validators/staff.schema';

// Inferred types from validators
export type {
  CreateStaffInput,
  UpdateStaffInput,
  StaffListFiltersInput,
  CreateLeaveInput,
  UpdateLeaveStatusInput,
  LeaveListFiltersInput,
  CreateAssignmentInput,
  BulkAssignmentInput,
} from './validators/staff.schema';

