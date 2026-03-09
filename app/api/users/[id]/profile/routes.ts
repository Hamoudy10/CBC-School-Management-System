// app/api/users/[id]/profile/route.ts
// ============================================================
// GET /api/users/:id/profile - Get user profile
// PUT /api/users/:id/profile - Update user profile
// ============================================================

import { NextRequest } from "next/server";
import { withAuth } from "@/lib/api/withAuth";
import { validateBody, validateUuid } from "@/lib/api/validation";
import {
  successResponse,
  errorResponse,
  notFoundResponse,
  validationErrorResponse,
} from "@/lib/api/response";
import {
  getUserProfile,
  updateUserProfile,
  updateProfileSchema,
} from "@/features/users";

// ============================================================
// GET Handler - Get User Profile
// ============================================================
export const GET = withAuth(async (request, { user, params }) => {
  const id = params?.id;
  if (!id) return notFoundResponse("User ID required");

  const validation = validateUuid(id);
  if (!validation.success) {
    return validationErrorResponse(validation.errors!);
  }

  const profile = await getUserProfile(id, user);

  if (!profile) {
    return notFoundResponse("Profile not found");
  }

  return successResponse(profile);
});

// ============================================================
// PUT Handler - Update User Profile
// ============================================================
export const PUT = withAuth(async (request, { user, params }) => {
  const id = params?.id;
  if (!id) return notFoundResponse("User ID required");

  const idValidation = validateUuid(id);
  if (!idValidation.success) {
    return validationErrorResponse(idValidation.errors!);
  }

  const bodyValidation = await validateBody(request, updateProfileSchema);
  if (!bodyValidation.success) {
    return validationErrorResponse(bodyValidation.errors!);
  }

  const result = await updateUserProfile(id, bodyValidation.data!, user);

  if (!result.success) {
    return errorResponse(result.message);
  }

  return successResponse({ message: result.message });
});
