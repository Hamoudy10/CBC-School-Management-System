// app/api/timetable/teacher/[id]/route.ts
// ============================================================
// GET /api/timetable/teacher/:id - Get teacher-specific weekly timetable
// ============================================================

import { NextRequest } from "next/server";
import { z } from "zod";
import { withAuth } from "@/lib/api/withAuth";
import { validateQuery, validateUuid } from "@/lib/api/validation";
import {
  successResponse,
  errorResponse,
  notFoundResponse,
  validationErrorResponse,
} from "@/lib/api/response";
import { timetableService } from "@/features/timetable/services/timetable.service";

const querySchema = z.object({
  termId: z.string().uuid(),
  academicYearId: z.string().uuid(),
});

export const GET = withAuth(async (request: NextRequest, { user, params }) => {
  const teacherId = params?.id;
  if (!teacherId) {
    return notFoundResponse("Teacher ID required");
  }

  const idValidation = validateUuid(teacherId);
  if (!idValidation.success) {
    return validationErrorResponse(idValidation.errors!);
  }

  const { searchParams } = new URL(request.url);
  const validation = validateQuery(searchParams, querySchema);
  if (!validation.success) {
    return validationErrorResponse(validation.errors!);
  }

  const { termId, academicYearId } = validation.data!;

  try {
    const timetable = await timetableService.getTeacherTimetable(
      teacherId,
      termId,
      academicYearId,
      user,
    );
    return successResponse(timetable);
  } catch (err) {
    return errorResponse(
      err instanceof Error ? err.message : "Failed to load teacher timetable.",
      500
    );
  }
});
