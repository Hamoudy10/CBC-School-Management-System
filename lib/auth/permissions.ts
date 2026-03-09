// lib/auth/permissions.ts
// ============================================================
// Permission checking utilities
// Used by middleware, API routes, and UI components
// Never trust frontend — always verify server-side
// ============================================================

import {
  PERMISSION_MATRIX,
  ROLE_HIERARCHY,
  type RoleName,
  type ModuleName,
  type ActionName,
} from "@/types/roles";

// ============================================================
// Check if a role has permission for a module + action
// ============================================================
export function hasPermission(
  role: RoleName,
  module: ModuleName,
  action: ActionName,
): boolean {
  const rolePermissions = PERMISSION_MATRIX[role];
  if (!rolePermissions) return false;

  const modulePermissions = rolePermissions[module];
  if (!modulePermissions) return false;

  return modulePermissions.includes(action);
}

// ============================================================
// Check if a role has access to a module (any action)
// ============================================================
export function hasModuleAccess(role: RoleName, module: ModuleName): boolean {
  const rolePermissions = PERMISSION_MATRIX[role];
  if (!rolePermissions) return false;

  const modulePermissions = rolePermissions[module];
  return !!modulePermissions && modulePermissions.length > 0;
}

// ============================================================
// Get all allowed actions for a role on a module
// ============================================================
export function getAllowedActions(
  role: RoleName,
  module: ModuleName,
): ActionName[] {
  const rolePermissions = PERMISSION_MATRIX[role];
  if (!rolePermissions) return [];

  return rolePermissions[module] ?? [];
}

// ============================================================
// Get all accessible modules for a role
// ============================================================
export function getAccessibleModules(role: RoleName): ModuleName[] {
  const rolePermissions = PERMISSION_MATRIX[role];
  if (!rolePermissions) return [];

  return Object.entries(rolePermissions)
    .filter(([, actions]) => actions && actions.length > 0)
    .map(([module]) => module as ModuleName);
}

// ============================================================
// Check if role A can manage role B (escalation prevention)
// A user can only manage roles lower than their own
// ============================================================
export function canManageRole(
  managerRole: RoleName,
  targetRole: RoleName,
): boolean {
  const managerLevel = ROLE_HIERARCHY[managerRole];
  const targetLevel = ROLE_HIERARCHY[targetRole];

  if (managerLevel === undefined || targetLevel === undefined) return false;

  return managerLevel > targetLevel;
}

// ============================================================
// Check if role is admin-level
// ============================================================
export function isAdminRole(role: RoleName): boolean {
  return ROLE_HIERARCHY[role] >= 65;
}

// ============================================================
// Check if role is teaching-level
// ============================================================
export function isTeachingRole(role: RoleName): boolean {
  return ["teacher", "class_teacher", "subject_teacher"].includes(role);
}

// ============================================================
// Check if role is finance-level
// ============================================================
export function isFinanceRole(role: RoleName): boolean {
  return ["finance_officer", "bursar"].includes(role);
}

export { ROLE_HIERARCHY };
