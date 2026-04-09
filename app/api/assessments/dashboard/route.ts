export const dynamic = 'force-dynamic';

// app/api/assessments/dashboard/route.ts
// ============================================================
// GET /api/assessments/dashboard - Class overview dashboard with analytics
// ============================================================

import { NextRequest } from "next/server";
import { z } from "zod";
import { withPermission } from "@/lib/api/withAuth";
import { validateQuery } from "@/lib/api/validation";
import {
  successResponse,
  errorResponse,
  validationErrorResponse,
} from "@/lib/api/response";
import {
  getClassPerformanceSummary,
  getSchoolPerformanceDashboard,
  getLearningAreaAnalytics,
} from "@/features/assessments";

const querySchema = z.object({
  classId: z.string().uuid().optional(),
  termId: z.string().uuid(),
  academicYearId: z.string().uuid(),
  learningAreaId: z.string().uuid().optional(),
  scope: z.enum(["class", "school"]).optional().default("class"),
});

export const GET = withPermission(
  "assessments",
  "view",
  async (request: NextRequest, { user }) => {
    const { searchParams } = new URL(request.url);
    const validation = validateQuery(searchParams, querySchema);

    if (!validation.success) {
      return validationErrorResponse(validation.errors!);
    }

    const { classId, termId, academicYearId, learningAreaId, scope } = validation.data!;

    try {
      if (scope === "school") {
        const schoolDashboard = await getSchoolPerformanceDashboard(
          academicYearId,
          termId,
          user,
        );

        return successResponse({
          scope: "school",
          ...schoolDashboard,
        });
      }

      if (!classId) {
        return errorResponse("classId is required when scope is 'class'.", 400);
      }

      const classSummary = await getClassPerformanceSummary(
        classId,
        termId,
        academicYearId,
        user,
      );

      if (!classSummary) {
        return errorResponse("Class not found or no data available.", 404);
      }

      let learningAreaDetail = null;
      if (learningAreaId) {
        learningAreaDetail = await getLearningAreaAnalytics(
          classId,
          learningAreaId,
          termId,
          academicYearId,
          user,
        );
      }

      return successResponse({
        scope: "class",
        classSummary,
        learningAreaDetail,
      });
    } catch (err) {
      return errorResponse(
        err instanceof Error ? err.message : "Failed to load assessment dashboard.",
        500,
      );
    }
  },
);
