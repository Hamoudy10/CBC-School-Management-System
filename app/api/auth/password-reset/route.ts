// app/api/auth/password-reset/route.ts
// ============================================================
// POST /api/auth/password-reset
// Request password reset email
// ============================================================

import { NextRequest } from "next/server";
import { z } from "zod";
import { validateBody } from "@/lib/api/validation";
import { checkPasswordResetRateLimit } from "@/lib/api/rateLimit";
import {
  successResponse,
  validationErrorResponse,
  rateLimitResponse,
} from "@/lib/api/response";
import { createSupabaseServerClient } from "@/lib/supabase/server";

// ============================================================
// Validation Schema
// ============================================================
const passwordResetSchema = z.object({
  email: z.string().email("Invalid email address"),
});

// ============================================================
// POST Handler
// ============================================================
export async function POST(request: NextRequest) {
  // Rate limiting
  const rateLimit = checkPasswordResetRateLimit(request);
  if (!rateLimit.allowed) {
    return rateLimitResponse(
      "Too many password reset requests. Please try again later.",
    );
  }

  // Validate body
  const validation = await validateBody(request, passwordResetSchema);
  if (!validation.success) {
    return validationErrorResponse(validation.errors!);
  }

  const { email } = validation.data!;
  const supabase = await createSupabaseServerClient();

  // Get origin for redirect URL
  const origin =
    request.headers.get("origin") || process.env.NEXT_PUBLIC_APP_URL;

  await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${origin}/auth/reset-password`,
  });

  // Always return success to prevent email enumeration
  return successResponse({
    message:
      "If an account exists with this email, a reset link has been sent.",
  });
}
