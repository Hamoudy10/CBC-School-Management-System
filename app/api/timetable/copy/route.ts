export const dynamic = 'force-dynamic';

// app/api/timetable/copy/route.ts
// ============================================================
// POST /api/timetable/copy - Copy timetable from one term to another
// DELETE /api/timetable/deactivate-term - Deactivate all slots for a term
// ============================================================

import { NextRequest } from "next/server";
import { z } from "zod";
import { withPermission } from "@/lib/api/withAuth";
import { validateBody, validateQuery } from "@/lib/api/validation";
import {
  successResponse,
  errorResponse,
  validationErrorResponse,
} from "@/lib/api/response";
import { timetableService } from "@/features/timetable/services/timetable.service";

const copySchema = z.object({
  sourceTermId: z.string().uuid(),
  targetTermId: z.string().uuid(),
  targetAcademicYearId: z.string().uuid(),
});

const deactivateSchema = z.object({
  termId: z.string().uuid(),
});

export const POST = withPermission(
  "timetable",
  "create",
  async (request: NextRequest, { user }) => {
    const bodyValidation = await validateBody(request, copySchema);
    if (!bodyValidation.success) {
      return validationErrorResponse(bodyValidation.errors!);
    }

    const { sourceTermId, targetTermId, targetAcademicYearId } = bodyValidation.data!;

    try {
      const result = await timetableService.copyTimetable(
        sourceTermId,
        targetTermId,
        targetAcademicYearId,
        user,
      );
      return successResponse({
        message: `Copied ${result.copied} timetable slots to the target term.`,
        copied: result.copied,
      });
    } catch (err) {
      return errorResponse(
        err instanceof Error ? err.message : "Failed to copy timetable.",
        500,
      );
    }
  },
);

export const DELETE = withPermission(
  "timetable",
  "delete",
  async (request: NextRequest, { user }) => {
    const { searchParams } = new URL(request.url);
    const termId = searchParams.get("termId");

    if (!termId) {
      return errorResponse("termId query parameter is required.", 400);
    }

    const validation = validateQuery(searchParams, z.object({ termId: z.string().uuid() }));
    if (!validation.success) {
      return validationErrorResponse(validation.errors!);
    }

    try {
      const result = await timetableService.deactivateTermSlots(termId, user);
      return successResponse({
        message: `Deactivated ${result.deactivated} timetable slots for the term.`,
        deactivated: result.deactivated,
      });
    } catch (err) {
      return errorResponse(
        err instanceof Error ? err.message : "Failed to deactivate term slots.",
        500,
      );
    }
  },
);
