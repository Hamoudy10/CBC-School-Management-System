// features/users/types.ts
// ============================================================
// Type definitions for User Management module
// Covers: users, roles, permissions, audit trails
// ============================================================

import type { RoleName } from "@/types/roles";

// ============================================================
// User Types
// ============================================================
export interface User {
  userId: string;
  email: string;
  firstName: string;
  lastName: string;
  middleName: string | null;
  phone: string | null;
  gender: "male" | "female" | "other" | null;
  status: "active" | "inactive" | "suspended" | "archived";
  emailVerified: boolean;
  schoolId: string | null;
  roleId: string;
  roleName: RoleName;
  lastLoginAt: string | null;
  createdAt: string;
  updatedAt: string;
  createdBy: string | null;
}

export interface UserListItem {
  userId: string;
  email: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  gender: "male" | "female" | "other" | null;
  status: "active" | "inactive" | "suspended" | "archived";
  roleName: RoleName;
  lastLoginAt: string | null;
  createdAt: string;
}

export interface UserProfile {
  profileId: string;
  userId: string;
  dateOfBirth: string | null;
  address: string | null;
  photoUrl: string | null;
  nationalId: string | null;
  emergencyContactName: string | null;
  emergencyContactPhone: string | null;
  bloodGroup: string | null;
  medicalConditions: string | null;
}

// ============================================================
// Create / Update Payloads
// ============================================================
export interface CreateUserPayload {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  middleName?: string;
  phone?: string;
  gender?: "male" | "female" | "other";
  roleId: string;
  schoolId: string;
}

export interface UpdateUserPayload {
  firstName?: string;
  lastName?: string;
  middleName?: string;
  phone?: string;
  gender?: "male" | "female" | "other";
  status?: "active" | "inactive" | "suspended" | "archived";
  roleId?: string;
}

export interface UpdateProfilePayload {
  dateOfBirth?: string;
  address?: string;
  photoUrl?: string;
  nationalId?: string;
  emergencyContactName?: string;
  emergencyContactPhone?: string;
  bloodGroup?: string;
  medicalConditions?: string;
}

// ============================================================
// Role Types
// ============================================================
export interface Role {
  roleId: string;
  name: RoleName;
  description: string | null;
  isSystemRole: boolean;
  createdAt: string;
}

// ============================================================
// Permission Types (application-level, supplements DB RLS)
// ============================================================
export interface Permission {
  permissionId: string;
  roleId: string;
  moduleName: string;
  canRead: boolean;
  canCreate: boolean;
  canUpdate: boolean;
  canDelete: boolean;
}

export interface UpdatePermissionPayload {
  canRead?: boolean;
  canCreate?: boolean;
  canUpdate?: boolean;
  canDelete?: boolean;
}

// ============================================================
// Audit Trail Types
// ============================================================
export interface AuditTrailEntry {
  id: string;
  schoolId: string | null;
  tableName: string;
  recordId: string | null;
  action: string;
  performedBy: string | null;
  performedByName?: string;
  performedAt: string;
  ipAddress: string | null;
  oldData: Record<string, any> | null;
  newData: Record<string, any> | null;
  details: Record<string, any> | null;
}

// ============================================================
// List / Filter Types
// ============================================================
export interface UserListFilters {
  search?: string;
  role?: RoleName;
  status?: "active" | "inactive" | "suspended" | "archived";
  schoolId?: string;
  page?: number;
  pageSize?: number;
  sortBy?:
    | "first_name"
    | "last_name"
    | "email"
    | "created_at"
    | "last_login_at";
  sortOrder?: "asc" | "desc";
}

export interface AuditTrailFilters {
  userId?: string;
  action?: string;
  tableName?: string;
  startDate?: string;
  endDate?: string;
  page?: number;
  pageSize?: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}
