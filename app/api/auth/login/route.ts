// app/api/auth/login/route.ts
// ============================================================
// POST /api/auth/login
// Authenticate user with email/password
// ============================================================

export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import { z } from "zod";
import { validateBody } from "@/lib/api/validation";
import { checkLoginRateLimit } from "@/lib/api/rateLimit";
import {
  successResponse,
  errorResponse,
  validationErrorResponse,
  rateLimitResponse,
} from "@/lib/api/response";
import { login } from "@/services/auth.service";
import { logLoginAttempt } from "@/services/audit.service";

// ============================================================
// Validation Schema
// ============================================================
const loginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
});

// ============================================================
// POST Handler
// ============================================================
export async function POST(request: NextRequest) {
  // Rate limiting
  const rateLimit = checkLoginRateLimit(request);
  if (!rateLimit.allowed) {
    return rateLimitResponse(
      "Too many login attempts. Please try again later.",
    );
  }

  // Validate body
  const validation = await validateBody(request, loginSchema);
  if (!validation.success) {
    return validationErrorResponse(validation.errors!);
  }

  const { email, password } = validation.data!;

  // Attempt login
  const result = await login({ email, password });

  // Log attempt
  const forwarded = request.headers.get("x-forwarded-for");
  const ip = forwarded?.split(",")[0]?.trim() || undefined;
  const userAgent = request.headers.get("user-agent") || undefined;

  await logLoginAttempt(
    email,
    result.success,
    result.user?.id,
    result.user?.schoolId || undefined,
    ip,
    userAgent,
  );

  if (!result.success) {
    return errorResponse(result.message, 401);
  }

  return successResponse({
    user: result.user,
    message: result.message,
  });
}
