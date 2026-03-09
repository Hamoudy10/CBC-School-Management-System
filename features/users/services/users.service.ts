// features/users/services/users.service.ts
// ============================================================
// User CRUD service — server-side only
// All operations go through Supabase with RLS enforcement
// Handles: list, get, create, update, deactivate users
// ============================================================

import {
  createSupabaseServerClient,
  createSupabaseAdminClient,
} from "@/lib/supabase/server";
import { canManageRole } from "@/lib/auth/permissions";
import type { AuthUser } from "@/types/auth";
import type { RoleName } from "@/types/roles";
import type {
  User,
  UserListItem,
  UserProfile,
  PaginatedResponse,
} from "../types";
import type {
  CreateUserInput,
  UpdateUserInput,
  UpdateProfileInput,
  UserListFiltersInput,
} from "../validators/user.schema";

// ============================================================
// LIST USERS (paginated, filtered, sorted)
// ============================================================
export async function listUsers(
  filters: UserListFiltersInput,
  currentUser: AuthUser,
): Promise<PaginatedResponse<UserListItem>> {
  const supabase = await createSupabaseServerClient();

  const { page, pageSize, sortBy, sortOrder, search, role, status, schoolId } =
    filters;
  const offset = (page - 1) * pageSize;

  // Build query
  let query = supabase.from("users").select(
    `
      user_id,
      email,
      first_name,
      last_name,
      phone,
      gender,
      status,
      last_login_at,
      created_at,
      roles!inner (
        name
      )
    `,
    { count: "exact" },
  );

  // School scoping (non-super-admin only sees own school)
  if (currentUser.role !== "super_admin") {
    query = query.eq("school_id", currentUser.schoolId!);
  } else if (schoolId) {
    query = query.eq("school_id", schoolId);
  }

  // Filters
  if (search) {
    query = query.or(
      `first_name.ilike.%${search}%,last_name.ilike.%${search}%,email.ilike.%${search}%`,
    );
  }
  if (role) {
    query = query.eq("roles.name", role);
  }
  if (status) {
    query = query.eq("status", status);
  }

  // Sorting
  query = query.order(sortBy, { ascending: sortOrder === "asc" });

  // Pagination
  query = query.range(offset, offset + pageSize - 1);

  const { data, error, count } = await query;

  if (error) {
    throw new Error(`Failed to list users: ${error.message}`);
  }

  const users: UserListItem[] = (data || []).map((row: any) => ({
    userId: row.user_id,
    email: row.email,
    firstName: row.first_name,
    lastName: row.last_name,
    phone: row.phone,
    gender: row.gender,
    status: row.status,
    roleName: row.roles?.name as RoleName,
    lastLoginAt: row.last_login_at,
    createdAt: row.created_at,
  }));

  const total = count || 0;

  return {
    data: users,
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  };
}

// ============================================================
// GET SINGLE USER BY ID
// ============================================================
export async function getUserById(
  userId: string,
  currentUser: AuthUser,
): Promise<User | null> {
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("users")
    .select(
      `
      user_id,
      email,
      first_name,
      last_name,
      middle_name,
      phone,
      gender,
      status,
      email_verified,
      school_id,
      role_id,
      last_login_at,
      created_at,
      updated_at,
      created_by,
      roles (
        name
      )
    `,
    )
    .eq("user_id", userId)
    .single();

  if (error || !data) return null;

  // School scoping check (redundant with RLS but defense in depth)
  if (
    currentUser.role !== "super_admin" &&
    (data as any).school_id !== currentUser.schoolId &&
    (data as any).user_id !== currentUser.id
  ) {
    return null;
  }

  return {
    userId: (data as any).user_id,
    email: (data as any).email,
    firstName: (data as any).first_name,
    lastName: (data as any).last_name,
    middleName: (data as any).middle_name,
    phone: (data as any).phone,
    gender: (data as any).gender,
    status: (data as any).status as User["status"],
    emailVerified: (data as any).email_verified,
    schoolId: (data as any).school_id,
    roleId: (data as any).role_id,
    roleName: ((data as any).roles as any)?.name as RoleName,
    lastLoginAt: (data as any).last_login_at,
    createdAt: (data as any).created_at,
    updatedAt: (data as any).updated_at,
    createdBy: (data as any).created_by,
  };
}

// ============================================================
// GET USER PROFILE (extended info)
// ============================================================
export async function getUserProfile(
  userId: string,
  currentUser: AuthUser,
): Promise<UserProfile | null> {
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("user_profiles")
    .select("*")
    .eq("user_id", userId)
    .single();

  if (error || !data) return null;

  // School scoping
  if (
    currentUser.role !== "super_admin" &&
    (data as any).school_id !== currentUser.schoolId &&
    userId !== currentUser.id
  ) {
    return null;
  }

  return {
    profileId: (data as any).profile_id,
    userId: (data as any).user_id,
    dateOfBirth: (data as any).date_of_birth,
    address: (data as any).address,
    photoUrl: (data as any).photo_url,
    nationalId: (data as any).national_id,
    emergencyContactName: (data as any).emergency_contact_name,
    emergencyContactPhone: (data as any).emergency_contact_phone,
    bloodGroup: (data as any).blood_group,
    medicalConditions: (data as any).medical_conditions,
  };
}

// ============================================================
// CREATE USER
// ============================================================
export async function createUser(
  payload: CreateUserInput,
  currentUser: AuthUser,
): Promise<{ success: boolean; message: string; userId?: string }> {
  // Step 1: Validate role assignment (escalation prevention)
  const targetRoleName = await getRoleNameById(payload.roleId);
  if (!targetRoleName) {
    return { success: false, message: "Invalid role specified." };
  }

  if (!canManageRole(currentUser.role, targetRoleName)) {
    return {
      success: false,
      message:
        "Cannot create user with a role equal to or higher than your own.",
    };
  }

  // Step 2: School scoping
  if (
    currentUser.role !== "super_admin" &&
    payload.schoolId !== currentUser.schoolId
  ) {
    return {
      success: false,
      message: "Cannot create users in another school.",
    };
  }

  const adminClient = await createSupabaseAdminClient();

  // Step 3: Check duplicate email
  const { data: existing } = await adminClient
    .from("users")
    .select("user_id")
    .eq("email", payload.email)
    .maybeSingle();

  if (existing) {
    return {
      success: false,
      message: "A user with this email already exists.",
    };
  }

  // Step 4: Create Supabase auth user
  const { data: authData, error: authError } =
    await adminClient.auth.admin.createUser({
      email: payload.email,
      password: payload.password,
      email_confirm: false,
      user_metadata: {
        first_name: payload.firstName,
        last_name: payload.lastName,
      },
    });

  if (authError || !authData.user) {
    return {
      success: false,
      message: `Auth creation failed: ${authError?.message || "Unknown error"}`,
    };
  }

  // Step 5: Create users table record
  const { error: insertError } = await (adminClient.from("users") as any).insert({
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
    created_by: currentUser.id,
  });

  if (insertError) {
    // Rollback auth user
    await adminClient.auth.admin.deleteUser(authData.user.id);
    return {
      success: false,
      message: `Profile creation failed: ${insertError.message}`,
    };
  }

  // Step 6: Create empty user_profiles record
  await (adminClient.from("user_profiles") as any).insert({
    user_id: authData.user.id,
    school_id: payload.schoolId,
  });

  return {
    success: true,
    message: "User created successfully.",
    userId: authData.user.id,
  };
}

// ============================================================
// UPDATE USER
// ============================================================
export async function updateUser(
  userId: string,
  payload: UpdateUserInput,
  currentUser: AuthUser,
): Promise<{ success: boolean; message: string }> {
  const supabase = await createSupabaseServerClient();

  // Self-update restrictions
  const isSelfUpdate = userId === currentUser.id;

  if (isSelfUpdate) {
    // Users cannot change their own role or status
    if (payload.roleId || payload.status) {
      return {
        success: false,
        message: "You cannot change your own role or status.",
      };
    }
  }

  // Role change validation
  if (payload.roleId) {
    const newRoleName = await getRoleNameById(payload.roleId);
    if (!newRoleName) {
      return { success: false, message: "Invalid role specified." };
    }
    if (!canManageRole(currentUser.role, newRoleName)) {
      return {
        success: false,
        message: "Cannot assign a role equal to or higher than your own.",
      };
    }

    // Check target user's current role
    const targetUser = await getUserById(userId, currentUser);
    if (!targetUser) {
      return { success: false, message: "User not found." };
    }
    if (!canManageRole(currentUser.role, targetUser.roleName)) {
      return {
        success: false,
        message:
          "Cannot modify a user with a role equal to or higher than your own.",
      };
    }
  }

  // Build update object
  const updateData: Record<string, any> = {
    updated_by: currentUser.id,
  };

  if (payload.firstName !== undefined)
    updateData.first_name = payload.firstName;
  if (payload.lastName !== undefined) updateData.last_name = payload.lastName;
  if (payload.middleName !== undefined)
    updateData.middle_name = payload.middleName || null;
  if (payload.phone !== undefined) updateData.phone = payload.phone || null;
  if (payload.gender !== undefined) updateData.gender = payload.gender;
  if (payload.status !== undefined) updateData.status = payload.status;
  if (payload.roleId !== undefined) updateData.role_id = payload.roleId;

  const { error } = await (supabase
    .from("users") as any)
    .update(updateData)
    .eq("user_id", userId);

  if (error) {
    return { success: false, message: `Update failed: ${error.message}` };
  }

  return { success: true, message: "User updated successfully." };
}

// ============================================================
// UPDATE USER PROFILE (extended info)
// ============================================================
export async function updateUserProfile(
  userId: string,
  payload: UpdateProfileInput,
  currentUser: AuthUser,
): Promise<{ success: boolean; message: string }> {
  const supabase = await createSupabaseServerClient();

  // Only self or admin can update profiles
  if (userId !== currentUser.id) {
    const isAdmin = [
      "super_admin",
      "school_admin",
      "principal",
      "deputy_principal",
      "ict_admin",
    ].includes(currentUser.role);
    if (!isAdmin) {
      return {
        success: false,
        message: "You can only update your own profile.",
      };
    }
  }

  const updateData: Record<string, any> = {};

  if (payload.dateOfBirth !== undefined)
    updateData.date_of_birth = payload.dateOfBirth;
  if (payload.address !== undefined) updateData.address = payload.address;
  if (payload.photoUrl !== undefined)
    updateData.photo_url = payload.photoUrl || null;
  if (payload.nationalId !== undefined)
    updateData.national_id = payload.nationalId;
  if (payload.emergencyContactName !== undefined)
    updateData.emergency_contact_name = payload.emergencyContactName;
  if (payload.emergencyContactPhone !== undefined)
    updateData.emergency_contact_phone = payload.emergencyContactPhone;
  if (payload.bloodGroup !== undefined)
    updateData.blood_group = payload.bloodGroup || null;
  if (payload.medicalConditions !== undefined)
    updateData.medical_conditions = payload.medicalConditions;

  const { error } = await (supabase
    .from("user_profiles") as any)
    .update(updateData)
    .eq("user_id", userId);

  if (error) {
    return {
      success: false,
      message: `Profile update failed: ${error.message}`,
    };
  }

  return { success: true, message: "Profile updated successfully." };
}

// ============================================================
// DEACTIVATE USER (soft delete)
// ============================================================
export async function deactivateUser(
  userId: string,
  currentUser: AuthUser,
): Promise<{ success: boolean; message: string }> {
  // Cannot deactivate self
  if (userId === currentUser.id) {
    return {
      success: false,
      message: "You cannot deactivate your own account.",
    };
  }

  // Check target user's role
  const targetUser = await getUserById(userId, currentUser);
  if (!targetUser) {
    return { success: false, message: "User not found." };
  }

  if (!canManageRole(currentUser.role, targetUser.roleName)) {
    return {
      success: false,
      message:
        "Cannot deactivate a user with a role equal to or higher than your own.",
    };
  }

  const supabase = await createSupabaseServerClient();

  const { error } = await (supabase
    .from("users") as any)
    .update({
      status: "inactive",
      updated_by: currentUser.id,
    })
    .eq("user_id", userId);

  if (error) {
    return { success: false, message: `Deactivation failed: ${error.message}` };
  }

  return { success: true, message: "User deactivated successfully." };
}

// ============================================================
// INTERNAL: Get role name by ID
// ============================================================
async function getRoleNameById(roleId: string): Promise<RoleName | null> {
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("roles")
    .select("name")
    .eq("role_id", roleId)
    .single();

  if (error || !data) return null;
  return (data as any).name as RoleName;
}
