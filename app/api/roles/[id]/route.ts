// app/api/roles/[id]/route.ts
// ============================================================
// GET    /api/roles/[id] - Fetch a single role by ID
// PUT    /api/roles/[id] - Update a role's name and description
// DELETE /api/roles/[id] - Delete a role
// ============================================================

import { NextRequest } from "next/server";
import { z } from "zod";
import { withPermission } from "@/lib/api/withAuth";
import {
  successResponse,
  errorResponse,
  notFoundResponse,
  validationErrorResponse,
} from "@/lib/api/response";
import { validateBody, validateUuid } from "@/lib/api/validation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getRoleById, getUserCountByRole } from "@/features/users";
import { ROLES, ROLE_HIERARCHY, type RoleName } from "@/types/roles";

// ============================================================
// Zod schema for updating a role
// ============================================================
const validRoleNames = Object.values(ROLES) as [RoleName, ...RoleName[]];

const updateRoleSchema = z.object({
  name: z.enum(validRoleNames).optional(),
  description: z.string().min(1, "Description is required").max(500).optional(),
});

// ============================================================
// GET Handler - Fetch a single role by ID
// ============================================================
const getRole = withPermission("users", "view", async (_request, context) => {
  const { params } = context;
  const roleId = params.id;

  // Validate UUID
  const idValidation = validateUuid(roleId);
  if (!idValidation.success) {
    return validationErrorResponse({ id: ["Invalid role ID format"] });
  }

  const role = await getRoleById(roleId);
  if (!role) {
    return notFoundResponse("Role not found");
  }

  // Get user count for this role
  const user = context.user;
  const counts = await getUserCountByRole(user);
  const userCount = counts.find((c) => c.roleName === role.name)?.count || 0;

  return successResponse({
    roleId: role.roleId,
    name: role.name,
    description: role.description,
    isSystemRole: role.isSystemRole,
    userCount,
    createdAt: role.createdAt,
  });
});

// ============================================================
// PUT Handler - Update a role's name and description
// ============================================================
const updateRole = withPermission("users", "update", async (request, context) => {
  const { params } = context;
  const roleId = params.id;

  // Validate UUID
  const idValidation = validateUuid(roleId);
  if (!idValidation.success) {
    return validationErrorResponse({ id: ["Invalid role ID format"] });
  }

  // Validate request body
  const validation = await validateBody(request, updateRoleSchema);
  if (!validation.success) {
    return validationErrorResponse(validation.errors || {});
  }

  const { name, description } = validation.data;

  // Check that at least one field is provided
  if (name === undefined && description === undefined) {
    return errorResponse("At least one field (name or description) is required", 400);
  }

  // Fetch the existing role
  const existingRole = await getRoleById(roleId);
  if (!existingRole) {
    return notFoundResponse("Role not found");
  }

  // System roles cannot be renamed
  if (name && name !== existingRole.name && existingRole.isSystemRole) {
    return errorResponse("System roles cannot be renamed", 403);
  }

  // Prevent renaming if there are users assigned to the role
  if (name && name !== existingRole.name) {
    const supabase = await createSupabaseServerClient();
    const { count, error } = await supabase
      .from("users")
      .select("*", { count: "exact", head: true })
      .eq("role_id", roleId);

    if (error) {
      console.error("Failed to count users for role:", error);
      return errorResponse("Failed to verify role assignments", 500);
    }

    if ((count ?? 0) > 0) {
      return errorResponse(
        `Cannot rename this role because ${count} user(s) are currently assigned to it. Reassign users to a different role first.`,
        409,
      );
    }
  }

  // Perform the update
  const supabase = await createSupabaseServerClient();
  const updateData: Record<string, unknown> = {};
  if (name !== undefined) {updateData.name = name;}
  if (description !== undefined) {updateData.description = description;}
  updateData.updated_at = new Date().toISOString();

  const { data, error } = await supabase
    .from("roles")
    .update(updateData)
    .eq("role_id", roleId)
    .select("*")
    .single();

  if (error) {
    console.error("Failed to update role:", error);
    return errorResponse("Failed to update role", 500);
  }

  return successResponse({
    roleId: (data as any).role_id,
    name: (data as any).name,
    description: (data as any).description,
    isSystemRole: (data as any).is_system_role,
    updatedAt: (data as any).updated_at,
  });
});

// ============================================================
// DELETE Handler - Delete a role
// ============================================================
const deleteRole = withPermission("users", "delete", async (_request, context) => {
  const { params } = context;
  const roleId = params.id;
  const user = context.user;

  // Validate UUID
  const idValidation = validateUuid(roleId);
  if (!idValidation.success) {
    return validationErrorResponse({ id: ["Invalid role ID format"] });
  }

  // Only super_admin can delete roles
  if (user.role !== ROLES.SUPER_ADMIN) {
    return errorResponse("Only super administrators can delete roles", 403);
  }

  // Fetch the existing role
  const existingRole = await getRoleById(roleId);
  if (!existingRole) {
    return notFoundResponse("Role not found");
  }

  // Check role hierarchy — cannot delete roles at or above own level
  const userHierarchy = ROLE_HIERARCHY[user.role as RoleName] ?? 0;
  const roleHierarchy = ROLE_HIERARCHY[existingRole.name as RoleName] ?? 0;
  if (roleHierarchy >= userHierarchy) {
    return errorResponse(
      "Cannot delete a role with equal or higher privilege level than your own",
      403,
    );
  }

  // Prevent deletion if there are users assigned to the role
  const supabase = await createSupabaseServerClient();
  const { count, error } = await supabase
    .from("users")
    .select("*", { count: "exact", head: true })
    .eq("role_id", roleId);

  if (error) {
    console.error("Failed to count users for role:", error);
    return errorResponse("Failed to verify role assignments", 500);
  }

  if ((count ?? 0) > 0) {
    return errorResponse(
      `Cannot delete this role because ${count} user(s) are currently assigned to it. Reassign users to a different role first.`,
      409,
    );
  }

  // Perform the delete
  const { error: deleteError } = await supabase
    .from("roles")
    .delete()
    .eq("role_id", roleId);

  if (deleteError) {
    console.error("Failed to delete role:", deleteError);
    return errorResponse("Failed to delete role", 500);
  }

  return successResponse({ message: "Role deleted successfully" });
});

// ============================================================
// Export route handlers
// ============================================================
export { getRole as GET, updateRole as PUT, deleteRole as DELETE };
