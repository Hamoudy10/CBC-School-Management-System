// app/api/analytics/school/route.ts
// ============================================================
// GET /api/analytics/school - Get school-wide dashboard data
// ============================================================

import { NextRequest } from "next/server";
import { z } from "zod";
import { withPermission } from "@/lib/api/withAuth";
import { validateQuery } from "@/lib/api/validation";
import { successResponse, validationErrorResponse } from "@/lib/api/response";
import { getSchoolPerformanceDashboard } from "@/features/assessments";

// ============================================================
// Query Schema
// ============================================================
const querySchema = z.object({
  termId: z.string().uuid().optional(),
  academicYearId: z.string().uuid().optional(),
});

// ============================================================
// GET Handler
// ============================================================
export const GET = withPermission(
  "analytics",
  "view",
  async (request, { user }) => {
    const { searchParams } = new URL(request.url);

    const validation = validateQuery(searchParams, querySchema);
    if (!validation.success) {
      return validationErrorResponse(validation.errors!);
    }

    let { termId, academicYearId } = validation.data ?? {};

    if (!user.schoolId) {
      return successResponse({
        totalStudents: 0,
        totalAssessments: 0,
        schoolAverage: 0,
        levelDistribution: {
          exceeding: 0,
          meeting: 0,
          approaching: 0,
          belowExpectation: 0,
        },
        topLearningAreas: [],
        lowPerformingAreas: [],
      });
    }

    if (!termId || !academicYearId) {
      const { createServerSupabaseClient } = await import("@/lib/supabase/server");
      const supabase = await createServerSupabaseClient();

      if (!academicYearId) {
        const { data: activeYear } = await supabase
          .from("academic_years")
          .select("academic_year_id")
          .eq("school_id", user.schoolId)
          .eq("is_active", true)
          .maybeSingle();

        academicYearId = activeYear?.academic_year_id;
      }

      if (!termId) {
        const { data: activeTerm } = await supabase
          .from("terms")
          .select("term_id")
          .eq("school_id", user.schoolId)
          .eq("is_active", true)
          .maybeSingle();

        termId = activeTerm?.term_id;
      }
    }

    if (!termId || !academicYearId) {
      return successResponse({
        totalStudents: 0,
        totalAssessments: 0,
        schoolAverage: 0,
        levelDistribution: {
          exceeding: 0,
          meeting: 0,
          approaching: 0,
          belowExpectation: 0,
        },
        topLearningAreas: [],
        lowPerformingAreas: [],
      });
    }

    const dashboard = await getSchoolPerformanceDashboard(
      academicYearId,
      termId,
      user,
    );

    return successResponse(dashboard);
  },
);
