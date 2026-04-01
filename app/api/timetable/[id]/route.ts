// app/api/timetable/[id]/route.ts
// ============================================================
// GET /api/timetable/:id - Get single timetable slot
// PATCH /api/timetable/:id - Update timetable slot
// DELETE /api/timetable/:id - Delete timetable slot
// ============================================================

import { NextRequest } from "next/server";
import { withPermission } from "@/lib/api/withAuth";
import { validateBody, validateUuid } from "@/lib/api/validation";
import {
  successResponse,
  errorResponse,
  notFoundResponse,
  validationErrorResponse,
} from "@/lib/api/response";
import {
  timetableService,
  ConflictError,
} from "@/features/timetable/services/timetable.service";
import { updateTimetableSlotSchema } from "@/features/timetable/validators/timetable.schema";

export const GET = withPermission(
  "timetable",
  "view",
  async (request: NextRequest, { user, params }) => {
    const slotId = params?.id;
    if (!slotId) {
      return notFoundResponse("Slot ID required");
    }

    const validation = validateUuid(slotId);
    if (!validation.success) {
      return validationErrorResponse(validation.errors!);
    }

    try {
      const slot = await timetableService.getSlotById(slotId, user);
      if (!slot) {
        return notFoundResponse("Timetable slot not found");
      }
      return successResponse(slot);
    } catch (err) {
      return errorResponse(
        err instanceof Error ? err.message : "Failed to load timetable slot.",
        500
      );
    }
  },
);

export const PATCH = withPermission(
  "timetable",
  "update",
  async (request: NextRequest, { user, params }) => {
    const slotId = params?.id;
    if (!slotId) {
      return notFoundResponse("Slot ID required");
    }

    const idValidation = validateUuid(slotId);
    if (!idValidation.success) {
      return validationErrorResponse(idValidation.errors!);
    }

    const bodyValidation = await validateBody(request, updateTimetableSlotSchema);
    if (!bodyValidation.success) {
      return validationErrorResponse(bodyValidation.errors!);
    }

    try {
      const slot = await timetableService.updateSlot(slotId, bodyValidation.data!, user);
      return successResponse(slot);
    } catch (err) {
      if (err instanceof ConflictError) {
        const conflictMessages = err.conflicts.flatMap(
          (c) => c.conflicts?.map((cc) => cc.message) ?? []
        );
        return errorResponse(
          `${err.message}${conflictMessages.length > 0 ? `: ${conflictMessages.join("; ")}` : ""}`,
          409
        );
      }
      return errorResponse(
        err instanceof Error ? err.message : "Failed to update timetable slot.",
        500
      );
    }
  },
);

export const DELETE = withPermission(
  "timetable",
  "delete",
  async (request: NextRequest, { user, params }) => {
    const slotId = params?.id;
    if (!slotId) {
      return notFoundResponse("Slot ID required");
    }

    const validation = validateUuid(slotId);
    if (!validation.success) {
      return validationErrorResponse(validation.errors!);
    }

    try {
      await timetableService.deleteSlot(slotId, user);
      return successResponse({ message: "Timetable slot deleted successfully." });
    } catch (err) {
      return errorResponse(
        err instanceof Error ? err.message : "Failed to delete timetable slot.",
        500
      );
    }
  },
);
