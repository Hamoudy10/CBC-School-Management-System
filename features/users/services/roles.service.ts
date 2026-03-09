// features/users/services/roles.service.ts
// ============================================================
// Role & Permission management service — server-side only
// Handles: list roles, get role, role permissions
// System roles cannot be deleted or renamed
// ============================================================

import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { AuthUser } from "@/types/auth";
import type { Role } from "../types";

// ============================================================
// LIST ALL ROLES
// ============================================================
export async function listRoles(currentUser: AuthUser): Promise<Role[]> {
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("roles")
    .select("*")
    .order("name", { ascending: true });

  if (error) {
    throw new Error(`Failed to list roles: ${error.message}`);
  }

  return (data || []).map((row: any) => ({
    roleId: row.role_id,
    name: row.name,
    description: row.description,
    isSystemRole: row.is_system_role,
    createdAt: row.created_at,
  }));
}

// ============================================================
// GET SINGLE ROLE BY ID
// ============================================================
export async function getRoleById(roleId: string): Promise<Role | null> {
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("roles")
    .select("*")
    .eq("role_id", roleId)
    .single();

  if (error || !data) return null;

  return {
    roleId: (data as any).role_id,
    name: (data as any).name,
    description: (data as any).description,
    isSystemRole: (data as any).is_system_role,
    createdAt: (data as any).created_at,
  };
}

// ============================================================
// GET ROLE BY NAME
// ============================================================
export async function getRoleByName(roleName: string): Promise<Role | null> {
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("roles")
    .select("*")
    .eq("name", roleName)
    .single();

  if (error || !data) return null;

  return {
    roleId: (data as any).role_id,
    name: (data as any).name,
    description: (data as any).description,
    isSystemRole: (data as any).is_system_role,
    createdAt: (data as any).created_at,
  };
}

// ============================================================
// GET USERS COUNT PER ROLE (for dashboard)
// ============================================================
export async function getUserCountByRole(
  currentUser: AuthUser,
): Promise<{ roleName: string; count: number }[]> {
  const supabase = await createSupabaseServerClient();

  let query = supabase.from("users").select(
    `
      role_id,
      roles (
        name
      )
    `,
  );

  // School scoping
  if (currentUser.role !== "super_admin") {
    query = query.eq("school_id", currentUser.schoolId!);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Failed to get role counts: ${error.message}`);
  }

  // Aggregate counts
  const counts = new Map<string, number>();
  for (const row of (data as any[]) || []) {
    const roleName = (row.roles as any)?.name || "unknown";
    counts.set(roleName, (counts.get(roleName) || 0) + 1);
  }

  return Array.from(counts.entries()).map(([roleName, count]) => ({
    roleName,
    count,
  }));
}
