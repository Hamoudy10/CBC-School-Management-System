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
import {
  createEmptyDashboardMetrics,
  type DashboardMetrics,
} from "@/types/dashboard";

// ============================================================
// Query Schema
// ============================================================
const querySchema = z.object({
  termId: z.string().uuid().optional(),
  academicYearId: z.string().uuid().optional(),
});

function mapSchoolAnalyticsToDashboardMetrics(analytics?: {
  totalStudents?: number;
  totalAssessments?: number;
  schoolAverage?: number;
}): DashboardMetrics {
  const metrics = createEmptyDashboardMetrics();

  if (!analytics) {
    return metrics;
  }

  return {
    ...metrics,
    students: {
      ...metrics.students,
      total: analytics.totalStudents ?? 0,
      active: analytics.totalStudents ?? 0,
    },
    assessments: {
      ...metrics.assessments,
      totalCompleted: analytics.totalAssessments ?? 0,
      averageScore: analytics.schoolAverage ?? 0,
    },
  };
}

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
      return successResponse(createEmptyDashboardMetrics());
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
      return successResponse(createEmptyDashboardMetrics());
    }

    const dashboard = await getSchoolPerformanceDashboard(
      academicYearId,
      termId,
      user,
    );

    return successResponse(mapSchoolAnalyticsToDashboardMetrics(dashboard));
  },
);
