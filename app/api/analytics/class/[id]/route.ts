// app/api/analytics/class/[id]/route.ts
// ============================================================
// GET /api/analytics/class/:id - Get class performance summary
// ============================================================

import { NextRequest } from "next/server";
import { z } from "zod";
import { withPermission } from "@/lib/api/withAuth";
import { validateQuery, validateUuid } from "@/lib/api/validation";
import {
  successResponse,
  notFoundResponse,
  validationErrorResponse,
} from "@/lib/api/response";
import { getClassPerformanceSummary } from "@/features/assessments";

// ============================================================
// Query Schema
// ============================================================
const querySchema = z.object({
  termId: z.string().uuid(),
  academicYearId: z.string().uuid(),
});

// ============================================================
// GET Handler
// ============================================================
export const GET = withPermission(
  "analytics",
  "view",
  async (request, { user, params }) => {
    const classId = params?.id;
    if (!classId) return notFoundResponse("Class ID required");

    const idValidation = validateUuid(classId);
    if (!idValidation.success) {
      return validationErrorResponse(idValidation.errors!);
    }

    const { searchParams } = new URL(request.url);
    const queryValidation = validateQuery(searchParams, querySchema);
    if (!queryValidation.success) {
      return validationErrorResponse(queryValidation.errors!);
    }

    const { termId, academicYearId } = queryValidation.data!;

    const summary = await getClassPerformanceSummary(
      classId,
      termId,
      academicYearId,
      user,
    );

    if (!summary) {
      return notFoundResponse("Class not found");
    }

    return successResponse(summary);
  },
);
