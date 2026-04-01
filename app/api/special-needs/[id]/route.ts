// app/api/special-needs/[id]/route.ts
// ============================================================
// GET /api/special-needs/:id - Get special needs record details
// PUT /api/special-needs/:id - Update special needs record
// DELETE /api/special-needs/:id - Deactivate special needs record
// ============================================================

import { withPermission } from "@/lib/api/withAuth";
import { validateBody, validateUuid } from "@/lib/api/validation";
import {
  successResponse,
  errorResponse,
  notFoundResponse,
  validationErrorResponse,
} from "@/lib/api/response";
import {
  getSpecialNeedById,
  updateSpecialNeed,
  deleteSpecialNeed,
  updateSpecialNeedSchema,
} from "@/features/special-needs";

export const GET = withPermission(
  "special_needs",
  "view",
  async (request, { user, params }) => {
    const id = params?.id;
    if (!id) {
      return notFoundResponse("Special needs ID required");
    }

    const validation = validateUuid(id);
    if (!validation.success) {
      return validationErrorResponse(validation.errors!);
    }

    const record = await getSpecialNeedById(id, user);

    if (!record) {
      return notFoundResponse("Special needs record not found");
    }

    return successResponse(record);
  },
);

export const PUT = withPermission(
  "special_needs",
  "update",
  async (request, { user, params }) => {
    const id = params?.id;
    if (!id) {
      return notFoundResponse("Special needs ID required");
    }

    const idValidation = validateUuid(id);
    if (!idValidation.success) {
      return validationErrorResponse(idValidation.errors!);
    }

    const bodyValidation = await validateBody(request, updateSpecialNeedSchema);
    if (!bodyValidation.success) {
      return validationErrorResponse(bodyValidation.errors!);
    }

    const result = await updateSpecialNeed(id, bodyValidation.data!, user);

    if (!result.success) {
      return errorResponse(result.message);
    }

    return successResponse({ message: result.message });
  },
);

export const DELETE = withPermission(
  "special_needs",
  "delete",
  async (request, { user, params }) => {
    const id = params?.id;
    if (!id) {
      return notFoundResponse("Special needs ID required");
    }

    const validation = validateUuid(id);
    if (!validation.success) {
      return validationErrorResponse(validation.errors!);
    }

    const result = await deleteSpecialNeed(id, user);

    if (!result.success) {
      return errorResponse(result.message);
    }

    return successResponse({ message: result.message });
  },
);
