// app/api/staff/[id]/reset-password/route.ts
// ============================================================
// POST /api/staff/[id]/reset-password - Reset staff password
// ============================================================

import { NextRequest } from "next/server";
import { withPermission } from "@/lib/api/withAuth";
import { errorResponse, successResponse, validationErrorResponse } from "@/lib/api/response";
import { validateUuid } from "@/lib/api/validation";
import { createSupabaseAdminClient } from "@/lib/supabase/server";

function generatePassword(length = 12) {
  const charset =
    "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%&*?";
  const values = new Uint32Array(length);
  crypto.getRandomValues(values);
  return Array.from(values, (value) => charset[value % charset.length]).join("");
}

export const POST = withPermission(
  "teachers",
  "update",
  async (request: NextRequest, { user, params }: any) => {
    try {
      const staffId = params?.id;
      const uuidValidation = validateUuid(staffId);
      if (!uuidValidation.success) {
        return validationErrorResponse(uuidValidation.errors!);
      }

      const body = await request.json().catch(() => ({}));
      const mode =
        typeof body?.mode === "string" && body.mode === "email"
          ? "email"
          : "password";
      const providedPassword =
        typeof body?.password === "string" && body.password.trim().length > 0
          ? body.password.trim()
          : null;

      const adminClient = await createSupabaseAdminClient();
      const { data: staff, error } = await adminClient
        .from("staff")
        .select("staff_id, school_id, user_id, users!inner(email)")
        .eq("staff_id", staffId)
        .single();

      if (error || !staff) {
        return errorResponse("Staff member not found", 404);
      }

      if (user.role !== "super_admin" && staff.school_id !== user.schoolId) {
        return errorResponse("Staff member not found", 404);
      }

      if (mode === "email") {
        const origin =
          request.headers.get("origin") || process.env.NEXT_PUBLIC_APP_URL;

        const { error: resetError } = await adminClient.auth.resetPasswordForEmail(
          (staff as any).users?.email,
          { redirectTo: `${origin}/auth/reset-password` },
        );

        if (resetError) {
          return errorResponse(resetError.message, 400);
        }

        return successResponse({
          staffId,
          email: (staff as any).users?.email,
          message: "Password reset email sent.",
        });
      }

      const password = providedPassword || generatePassword(12);
      if (password.length < 8) {
        return errorResponse("Password must be at least 8 characters", 400);
      }

      const { error: updateError } = await adminClient.auth.admin.updateUserById(
        staff.user_id,
        { password },
      );

      if (updateError) {
        return errorResponse(updateError.message, 400);
      }

      return successResponse({
        staffId,
        password,
        email: (staff as any).users?.email,
      });
    } catch (error) {
      console.error("Reset password error:", error);
      return errorResponse("Internal server error", 500);
    }
  },
);

