// app/api/users/[id]/route.ts
// ============================================================
// GET /api/users/:id - Get single user
// PUT /api/users/:id - Update user
// DELETE /api/users/:id - Deactivate user
// ============================================================

import { NextRequest } from "next/server";
import { withPermission, withAuth } from "@/lib/api/withAuth";
import { validateBody, validateUuid } from "@/lib/api/validation";
import {
  successResponse,
  errorResponse,
  notFoundResponse,
  validationErrorResponse,
} from "@/lib/api/response";
import {
  getUserById,
  updateUser,
  deactivateUser,
  updateUserSchema,
} from "@/features/users";

// ============================================================
// GET Handler - Get User by ID
// ============================================================
export const GET = withAuth(async (request, { user, params }) => {
  const id = params?.id;
  if (!id) return notFoundResponse("User ID required");

  const validation = validateUuid(id);
  if (!validation.success) {
    return validationErrorResponse(validation.errors!);
  }

  const targetUser = await getUserById(id, user);

  if (!targetUser) {
    return notFoundResponse("User not found");
  }

  return successResponse(targetUser);
});

// ============================================================
// PUT Handler - Update User
// ============================================================
export const PUT = withPermission(
  "users",
  "update",
  async (request, { user, params }) => {
    const id = params?.id;
    if (!id) return notFoundResponse("User ID required");

    const idValidation = validateUuid(id);
    if (!idValidation.success) {
      return validationErrorResponse(idValidation.errors!);
    }

    const bodyValidation = await validateBody(request, updateUserSchema);
    if (!bodyValidation.success) {
      return validationErrorResponse(bodyValidation.errors!);
    }

    const result = await updateUser(id, bodyValidation.data!, user);

    if (!result.success) {
      return errorResponse(result.message);
    }

    return successResponse({ message: result.message });
  },
);

// ============================================================
// DELETE Handler - Deactivate User
// ============================================================
export const DELETE = withPermission(
  "users",
  "delete",
  async (request, { user, params }) => {
    const id = params?.id;
    if (!id) return notFoundResponse("User ID required");

    const validation = validateUuid(id);
    if (!validation.success) {
      return validationErrorResponse(validation.errors!);
    }

    const result = await deactivateUser(id, user);

    if (!result.success) {
      return errorResponse(result.message);
    }

    return successResponse({ message: result.message });
  },
);
