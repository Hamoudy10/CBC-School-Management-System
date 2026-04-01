// app/api/staff/[id]/reactivate/route.ts
// ============================================================
// POST /api/staff/:id/reactivate - Reactivate a deactivated staff member
// ============================================================

import { NextRequest } from "next/server";
import { withPermission } from "@/lib/api/withAuth";
import { validateUuid } from "@/lib/api/validation";
import {
  successResponse,
  errorResponse,
  notFoundResponse,
  validationErrorResponse,
} from "@/lib/api/response";
import { reactivateStaff, getStaffById } from "@/features/staff/services/staff.services";

export const POST = withPermission(
  "teachers",
  "update",
  async (request: NextRequest, { user, params }) => {
    const staffId = params?.id;
    if (!staffId) {
      return notFoundResponse("Staff ID required");
    }

    const validation = validateUuid(staffId);
    if (!validation.success) {
      return validationErrorResponse(validation.errors!);
    }

    try {
      const existingStaff = await getStaffById(staffId, user);
      if (!existingStaff) {
        return notFoundResponse("Staff member not found.");
      }

      if (existingStaff.status !== "inactive") {
        return errorResponse("Staff member is already active.", 400);
      }

      const result = await reactivateStaff(staffId, user);

      if (!result.success) {
        return errorResponse(result.message, 400);
      }

      return successResponse({ message: result.message });
    } catch (err) {
      return errorResponse(
        err instanceof Error ? err.message : "Failed to reactivate staff member.",
        500
      );
    }
  },
);
