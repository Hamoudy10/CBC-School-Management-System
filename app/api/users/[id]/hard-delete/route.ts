export const dynamic = 'force-dynamic';
// app/api/users/[id]/hard-delete/route.ts
// ============================================================
// DELETE /api/users/:id/hard-delete - Permanently delete user
// ============================================================

import { withPermission } from "@/lib/api/withAuth";
import { validateUuid } from "@/lib/api/validation";
import {
  successResponse,
  errorResponse,
  notFoundResponse,
  validationErrorResponse,
} from "@/lib/api/response";
import { hardDeleteUser } from "@/features/users";

export const DELETE = withPermission(
  "users",
  "delete",
  async (request, { user, params }) => {
    const id = params?.id;
    if (!id) {return notFoundResponse("User ID required");}

    const validation = validateUuid(id);
    if (!validation.success) {
      return validationErrorResponse(validation.errors!);
    }

    const result = await hardDeleteUser(id, user);
    if (!result.success) {
      return errorResponse(result.message);
    }

    return successResponse({ message: result.message });
  },
);
