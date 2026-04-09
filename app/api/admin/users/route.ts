export const dynamic = 'force-dynamic';

// app/api/admin/users/route.ts
// ============================================================
// POST /api/admin/users - Create user by role name (admin helper)
// ============================================================

import { NextRequest } from "next/server";
import { z } from "zod";
import { withPermission } from "@/lib/api/withAuth";
import { validateBody } from "@/lib/api/validation";
import {
  createdResponse,
  errorResponse,
  validationErrorResponse,
} from "@/lib/api/response";
import { createUser, getRoleByName } from "@/features/users";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import type { RoleName } from "@/types/roles";

const roleNameSchema = z.enum([
  "super_admin",
  "school_admin",
  "principal",
  "deputy_principal",
  "teacher",
  "class_teacher",
  "subject_teacher",
  "finance_officer",
  "parent",
  "student",
  "bursar",
  "librarian",
  "ict_admin",
]);

const adminCreateUserSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),
  middleName: z.string().max(100).optional().or(z.literal("")),
  phone: z.string().max(20).optional().or(z.literal("")),
  gender: z.enum(["male", "female", "other"]).optional(),
  roleName: roleNameSchema,
});

const staffRoles = new Set<RoleName>([
  "principal",
  "deputy_principal",
  "teacher",
  "class_teacher",
  "subject_teacher",
  "finance_officer",
  "bursar",
  "librarian",
  "ict_admin",
]);

export const POST = withPermission(
  "users",
  "create",
  async (request: NextRequest, { user }) => {
    const validation = await validateBody(request, adminCreateUserSchema);
    if (!validation.success) {
      return validationErrorResponse(validation.errors!);
    }

    if (!user.schoolId) {
      return errorResponse("School context required to create users.");
    }

    const payload = validation.data;
    const role = await getRoleByName(payload.roleName as RoleName);
    if (!role) {
      return errorResponse("Invalid role name.");
    }

    const result = await createUser(
      {
        email: payload.email,
        password: payload.password,
        firstName: payload.firstName,
        lastName: payload.lastName,
        middleName: payload.middleName || "",
        phone: payload.phone || "",
        gender: payload.gender,
        roleId: role.roleId,
        schoolId: user.schoolId,
      },
      user,
    );

    if (!result.success) {
      return errorResponse(result.message);
    }

    let warning: string | undefined;
    if (staffRoles.has(payload.roleName as RoleName) && result.userId) {
      const adminClient = await createSupabaseAdminClient();
      const { data: existingStaff } = await adminClient
        .from("staff")
        .select("staff_id")
        .eq("user_id", result.userId)
        .maybeSingle();

      if (!existingStaff) {
        const { error: staffError } = await adminClient.from("staff").insert({
          school_id: user.schoolId,
          user_id: result.userId,
          position: payload.roleName,
          status: "active",
          created_by: user.id,
        });

        if (staffError) {
          warning = `User created but staff record failed: ${staffError.message}`;
        }
      }
    }

    return createdResponse({
      userId: result.userId,
      message: result.message,
      warning,
    });
  },
);
