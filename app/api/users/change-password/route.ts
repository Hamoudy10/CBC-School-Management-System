export const dynamic = 'force-dynamic';

// app/api/users/change-password/route.ts
// ============================================================
// POST /api/users/change-password
// Authenticated users change their own password
// ============================================================

import { NextRequest } from "next/server";
import { z } from "zod";
import { withAuth } from "@/lib/api/withAuth";
import { validateBody } from "@/lib/api/validation";
import {
  successResponse,
  errorResponse,
  validationErrorResponse,
} from "@/lib/api/response";
import { createSupabaseServerClient } from "@/lib/supabase/server";

// ============================================================
// Validation Schema
// ============================================================
const changePasswordSchema = z.object({
  currentPassword: z.string().min(6, "Current password must be at least 6 characters"),
  newPassword: z
    .string()
    .min(8, "New password must be at least 8 characters")
    .max(128, "New password must be at most 128 characters")
    .regex(/[A-Z]/, "New password must contain at least one uppercase letter")
    .regex(/[a-z]/, "New password must contain at least one lowercase letter")
    .regex(/[0-9]/, "New password must contain at least one number"),
});

// ============================================================
// POST Handler
// ============================================================
export const POST = withAuth(async (request: NextRequest, { user }) => {
  // Validate body
  const validation = await validateBody(request, changePasswordSchema);
  if (!validation.success) {
    return validationErrorResponse(validation.errors!);
  }

  const { currentPassword, newPassword } = validation.data!;
  const supabase = await createSupabaseServerClient();

  // Step 1: Verify current password by attempting to sign in
  const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
    email: user.email,
    password: currentPassword,
  });

  if (signInError || !signInData.user) {
    return errorResponse("Current password is incorrect", 401);
  }

  // Step 2: Update password
  const { error: updateError } = await supabase.auth.updateUser({
    password: newPassword,
  });

  if (updateError) {
    return errorResponse(updateError.message || "Failed to update password", 400);
  }

  return successResponse({
    message: "Password updated successfully. Please use your new password for future logins.",
  });
});
