// lib/auth/guards.ts
// ============================================================
// Server-side route guard utilities
// Used in server components and API routes
// Provides granular permission checks beyond middleware
// ============================================================

import { redirect } from "next/navigation";
import { getServerUser } from "@/services/auth.server.service";
import {
  hasPermission,
  hasModuleAccess,
  canManageRole,
} from "@/lib/auth/permissions";
import type { RoleName, ModuleName, ActionName } from "@/types/roles";
import type { AuthUser } from "@/types/auth";

// ============================================================
// Require authenticated user — redirect if not
// ============================================================
export async function requireAuth(): Promise<AuthUser> {
  const user = await getServerUser();

  if (!user) {
    redirect("/login");
  }

  if (user.status !== "active") {
    redirect(`/login?error=account_${user.status}`);
  }

  return user;
}

// ============================================================
// Require specific role(s) — redirect if unauthorized
// ============================================================
export async function requireRole(allowedRoles: RoleName[]): Promise<AuthUser> {
  const user = await requireAuth();

  if (!allowedRoles.includes(user.role)) {
    redirect("/dashboard");
  }

  return user;
}

// ============================================================
// Require module access — redirect if unauthorized
// ============================================================
export async function requireModuleAccess(
  module: ModuleName,
): Promise<AuthUser> {
  const user = await requireAuth();

  if (!hasModuleAccess(user.role, module)) {
    redirect("/dashboard");
  }

  return user;
}

// ============================================================
// Require specific permission — redirect if unauthorized
// ============================================================
export async function requirePermission(
  module: ModuleName,
  action: ActionName,
): Promise<AuthUser> {
  const user = await requireAuth();

  if (!hasPermission(user.role, module, action)) {
    redirect("/dashboard");
  }

  return user;
}

// ============================================================
// Require school context — for non-super-admin operations
// ============================================================
export async function requireSchoolContext(): Promise<
  AuthUser & { schoolId: string }
> {
  const user = await requireAuth();

  if (!user.schoolId && user.role !== "super_admin") {
    redirect("/login?error=no_school");
  }

  return user as AuthUser & { schoolId: string };
}

// ============================================================
// Validate user can manage target role (API routes)
// Returns { authorized, user, error }
// ============================================================
export async function validateRoleManagement(targetRole: RoleName): Promise<{
  authorized: boolean;
  user: AuthUser | null;
  error?: string;
}> {
  const user = await getServerUser();

  if (!user) {
    return { authorized: false, user: null, error: "Not authenticated" };
  }

  if (!canManageRole(user.role, targetRole)) {
    return {
      authorized: false,
      user,
      error: "Insufficient privileges for this role operation",
    };
  }

  return { authorized: true, user };
}

// ============================================================
// Validate school-scoped access (API routes)
// Ensures user belongs to the school they're trying to access
// ============================================================
export async function validateSchoolAccess(targetSchoolId: string): Promise<{
  authorized: boolean;
  user: AuthUser | null;
  error?: string;
}> {
  const user = await getServerUser();

  if (!user) {
    return { authorized: false, user: null, error: "Not authenticated" };
  }

  // Super admin can access any school
  if (user.role === "super_admin") {
    return { authorized: true, user };
  }

  // All others must match their own school
  if (user.schoolId !== targetSchoolId) {
    return {
      authorized: false,
      user,
      error: "You do not have access to this school",
    };
  }

  return { authorized: true, user };
}
