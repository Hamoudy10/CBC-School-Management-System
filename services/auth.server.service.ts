// services/auth.server.service.ts
// ============================================================
// Server-side authentication service
// Used in API routes and server components
// Handles user creation, role assignment, server-side session checks
// ============================================================

import {
  createSupabaseServerClient,
  createSupabaseAdminClient,
} from "@/lib/supabase/server";
import type { SignupPayload, AuthUser, AuthResponse } from "@/types/auth";
import type { RoleName } from "@/types/roles";
import { canManageRole, ROLE_HIERARCHY } from "@/lib/auth/permissions";

type UserRole = { name: RoleName } | null;

// ============================================================
// GET AUTHENTICATED USER (Server-side)
// ============================================================
export async function getServerUser(): Promise<AuthUser | null> {
  const supabase = await createSupabaseServerClient();
  const usersTable = () => supabase.from("users") as any;

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) return null;

  const { data: profile } = await usersTable()
    .select(
      `
      user_id,
      email,
      first_name,
      last_name,
      school_id,
      status,
      email_verified,
      roles (
        name
      )
    `,
    )
    .eq("user_id", user.id)
    .single();

  if (!profile) return null;

  return {
    id: profile.user_id,
    email: profile.email,
    firstName: profile.first_name,
    lastName: profile.last_name,
    role: (profile.roles as UserRole)?.name ?? "student",
    schoolId: profile.school_id,
    status: profile.status as AuthUser["status"],
    emailVerified: profile.email_verified,
  };
}

// ============================================================
// CREATE USER (Admin action — server-side only)
// Uses admin client to bypass RLS for user creation
// ============================================================
export async function createUser(
  payload: SignupPayload,
  createdBy: AuthUser,
): Promise<AuthResponse> {
  try {
    // Step 1: Validate the creator has permission
    const targetRoleName = await getRoleNameById(payload.roleId);
    if (!targetRoleName) {
      return { success: false, message: "Invalid role specified." };
    }

    // Step 2: Prevent role escalation
    if (!canManageRole(createdBy.role, targetRoleName)) {
      return {
        success: false,
        message:
          "You cannot create a user with a role equal to or higher than your own.",
      };
    }

    // Step 3: Enforce school scoping (non-super-admin can only create in own school)
    if (
      createdBy.role !== "super_admin" &&
      payload.schoolId !== createdBy.schoolId
    ) {
      return {
        success: false,
        message: "You can only create users in your own school.",
      };
    }

    const adminClient = await createSupabaseAdminClient();

    // Step 4: Create Supabase auth user
    const { data: authData, error: authError } =
      await adminClient.auth.admin.createUser({
        email: payload.email,
        password: payload.password,
        email_confirm: false, // Require email verification
        user_metadata: {
          first_name: payload.firstName,
          last_name: payload.lastName,
        },
      });

    if (authError) {
      return {
        success: false,
        message: "Failed to create authentication account.",
        error: authError.message,
      };
    }

    if (!authData.user) {
      return {
        success: false,
        message: "No user returned from auth creation.",
      };
    }

    // Step 5: Create user record in our users table
    const { error: profileError } = await (adminClient.from("users") as any).insert({
      user_id: authData.user.id,
      school_id: payload.schoolId,
      role_id: payload.roleId,
      email: payload.email,
      first_name: payload.firstName,
      last_name: payload.lastName,
      middle_name: payload.middleName || null,
      phone: payload.phone || null,
      gender: payload.gender || null,
      status: "active",
      email_verified: false,
      created_by: createdBy.id,
    });

    if (profileError) {
      // Rollback: delete the auth user if profile creation fails
      await adminClient.auth.admin.deleteUser(authData.user.id);
      return {
        success: false,
        message: "Failed to create user profile.",
        error: profileError.message,
      };
    }

    return {
      success: true,
      message: "User created successfully. Verification email will be sent.",
    };
  } catch (error) {
    console.error("Create user error:", error);
    return {
      success: false,
      message: "An unexpected error occurred during user creation.",
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

// ============================================================
// UPDATE USER ROLE (Admin action — with escalation prevention)
// ============================================================
export async function updateUserRole(
  targetUserId: string,
  newRoleId: string,
  performedBy: AuthUser,
): Promise<AuthResponse> {
  try {
    const newRoleName = await getRoleNameById(newRoleId);
    if (!newRoleName) {
      return { success: false, message: "Invalid role specified." };
    }

    // Prevent escalation
    if (!canManageRole(performedBy.role, newRoleName)) {
      return {
        success: false,
        message: "You cannot assign a role equal to or higher than your own.",
      };
    }

    // Prevent self-role change (except super_admin)
    if (targetUserId === performedBy.id && performedBy.role !== "super_admin") {
      return {
        success: false,
        message: "You cannot change your own role.",
      };
    }

    const supabase = await createSupabaseServerClient();

    const { error } = await (supabase.from("users") as any)
      .update({
        role_id: newRoleId,
        updated_by: performedBy.id,
      })
      .eq("user_id", targetUserId);

    if (error) {
      return {
        success: false,
        message: "Failed to update role.",
        error: error.message,
      };
    }

    return { success: true, message: "User role updated successfully." };
  } catch (error) {
    console.error("Update role error:", error);
    return { success: false, message: "An unexpected error occurred." };
  }
}

// ============================================================
// DEACTIVATE USER (Soft delete — never hard delete)
// ============================================================
export async function deactivateUser(
  targetUserId: string,
  performedBy: AuthUser,
): Promise<AuthResponse> {
  try {
    const supabase = await createSupabaseServerClient();

    // Get target user's role
    const { data: targetUser } = await (supabase.from("users") as any)
      .select("roles (name)")
      .eq("user_id", targetUserId)
      .single();

    if (!targetUser) {
      return { success: false, message: "User not found." };
    }

    const targetRole = (targetUser.roles as UserRole)?.name ?? "student";

    // Prevent deactivating higher/equal role
    if (!canManageRole(performedBy.role, targetRole)) {
      return {
        success: false,
        message:
          "You cannot deactivate a user with a role equal to or higher than your own.",
      };
    }

    const { error } = await (supabase.from("users") as any)
      .update({
        status: "inactive",
        updated_by: performedBy.id,
      })
      .eq("user_id", targetUserId);

    if (error) {
      return {
        success: false,
        message: "Failed to deactivate user.",
        error: error.message,
      };
    }

    return { success: true, message: "User deactivated successfully." };
  } catch (error) {
    console.error("Deactivate user error:", error);
    return { success: false, message: "An unexpected error occurred." };
  }
}

// ============================================================
// INTERNAL: Get role name by ID
// ============================================================
async function getRoleNameById(roleId: string): Promise<RoleName | null> {
  const supabase = await createSupabaseServerClient();

  const { data, error } = await (supabase.from("roles") as any)
    .select("name")
    .eq("role_id", roleId)
    .single();

  if (error || !data) return null;
  return data.name as RoleName;
}
