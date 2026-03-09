// components/auth/PermissionGate.tsx
// ============================================================
// Client component that conditionally renders children
// based on the user's role and permissions
// Used throughout the UI to show/hide elements per role
// ============================================================

"use client";

import { useAuth } from "@/hooks/useAuth";
import type { ModuleName, ActionName, RoleName } from "@/types/roles";

// ============================================================
// Props
// ============================================================
interface PermissionGateProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;

  // Option 1: Check by module + action
  module?: ModuleName;
  action?: ActionName;

  // Option 2: Check by role list
  allowedRoles?: RoleName[];

  // Option 3: Check by module access only (any action)
  requireModule?: ModuleName;

  // Invert logic: show if user does NOT have permission
  invert?: boolean;
}

// ============================================================
// Component
// ============================================================
export function PermissionGate({
  children,
  fallback = null,
  module,
  action,
  allowedRoles,
  requireModule,
  invert = false,
}: PermissionGateProps) {
  const { user, checkPermission, checkModuleAccess } = useAuth();

  if (!user) {
    return invert ? <>{children}</> : <>{fallback}</>;
  }

  let hasAccess = false;

  // Check by specific permission (module + action)
  if (module && action) {
    hasAccess = checkPermission(module, action);
  }
  // Check by allowed roles
  else if (allowedRoles) {
    hasAccess = allowedRoles.includes(user.role);
  }
  // Check by module access (any action)
  else if (requireModule) {
    hasAccess = checkModuleAccess(requireModule);
  }
  // No check specified — show by default
  else {
    hasAccess = true;
  }

  // Invert if needed
  if (invert) {
    hasAccess = !hasAccess;
  }

  return hasAccess ? <>{children}</> : <>{fallback}</>;
}

// ============================================================
// Convenience Components
// ============================================================

// Show only to admin-level users
export function AdminOnly({
  children,
  fallback,
}: {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}) {
  return (
    <PermissionGate
      allowedRoles={[
        "super_admin",
        "school_admin",
        "principal",
        "deputy_principal",
      ]}
      fallback={fallback}
    >
      {children}
    </PermissionGate>
  );
}

// Show only to teaching staff
export function TeacherOnly({
  children,
  fallback,
}: {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}) {
  return (
    <PermissionGate
      allowedRoles={["teacher", "class_teacher", "subject_teacher"]}
      fallback={fallback}
    >
      {children}
    </PermissionGate>
  );
}

// Show only to finance roles
export function FinanceOnly({
  children,
  fallback,
}: {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}) {
  return (
    <PermissionGate
      allowedRoles={[
        "super_admin",
        "school_admin",
        "principal",
        "finance_officer",
        "bursar",
      ]}
      fallback={fallback}
    >
      {children}
    </PermissionGate>
  );
}

// Show only to the user themselves (parent seeing own child, student seeing own)
export function SelfOnly({
  children,
  userId,
  fallback,
}: {
  children: React.ReactNode;
  userId: string;
  fallback?: React.ReactNode;
}) {
  const { user } = useAuth();

  if (!user || user.id !== userId) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}
