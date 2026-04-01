// app/api/assessments/area-results/route.ts
// ============================================================
// GET /api/assessments/area-results - Get learning area-level aggregation
// ============================================================

import { NextRequest } from "next/server";
import { z } from "zod";
import { withAuth } from "@/lib/api/withAuth";
import { validateQuery } from "@/lib/api/validation";
import {
  successResponse,
  errorResponse,
  validationErrorResponse,
} from "@/lib/api/response";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { mapScoreToLevel } from "@/features/assessments/services/performanceLevels.service";

const querySchema = z.object({
  studentId: z.string().uuid().optional(),
  classId: z.string().uuid().optional(),
  termId: z.string().uuid(),
  academicYearId: z.string().uuid(),
  learningAreaId: z.string().uuid().optional(),
});

export const GET = withAuth(async (request: NextRequest, { user }) => {
  const { searchParams } = new URL(request.url);
  const validation = validateQuery(searchParams, querySchema);

  if (!validation.success) {
    return validationErrorResponse(validation.errors!);
  }

  const { studentId, classId, termId, academicYearId, learningAreaId } = validation.data!;

  if (!studentId && !classId) {
    return errorResponse("Either studentId or classId is required.", 400);
  }

  try {
    const supabase = await createSupabaseServerClient();

    if (!user.schoolId) {
      return errorResponse("School context is required.", 400);
    }

    let query = supabase
      .from("assessments")
      .select(
        `
        score,
        student_id,
        learning_area_id,
        learning_areas (
          learning_area_id,
          name
        )
      `
      )
      .eq("term_id", termId)
      .eq("academic_year_id", academicYearId)
      .eq("school_id", user.schoolId);

    if (studentId) {
      query = query.eq("student_id", studentId);
    }
    if (classId) {
      query = query.eq("class_id", classId);
    }
    if (learningAreaId) {
      query = query.eq("learning_area_id", learningAreaId);
    }

    const { data: assessments, error } = await query;

    if (error) {
      return errorResponse(`Failed to load assessments: ${error.message}`, 500);
    }

    if (!assessments || assessments.length === 0) {
      return successResponse({ learningAreas: [], message: "No assessments found." });
    }

    // Group by learning area
    const laMap = new Map<
      string,
      {
        learningAreaId: string;
        learningAreaName: string;
        scores: number[];
        studentCount: Set<string>;
      }
    >();

    for (const assessment of assessments) {
      const la = (assessment as any).learning_areas;
      if (!la) continue;

      const laKey = la.learning_area_id;
      if (!laMap.has(laKey)) {
        laMap.set(laKey, {
          learningAreaId: la.learning_area_id,
          learningAreaName: la.name,
          scores: [],
          studentCount: new Set(),
        });
      }

      const entry = laMap.get(laKey)!;
      entry.scores.push(assessment.score);
      entry.studentCount.add(assessment.student_id);
    }

    const learningAreas = Array.from(laMap.entries()).map(([laId, data]) => {
      const avg = data.scores.reduce((a, b) => a + b, 0) / data.scores.length;
      return {
        learningAreaId: data.learningAreaId,
        learningAreaName: data.learningAreaName,
        averageScore: Math.round(avg * 100) / 100,
        level: mapScoreToLevel(avg),
        assessmentCount: data.scores.length,
        studentCount: data.studentCount.size,
        distribution: {
          exceeding: data.scores.filter((s) => s >= 4).length,
          meeting: data.scores.filter((s) => s >= 3 && s < 4).length,
          approaching: data.scores.filter((s) => s >= 2 && s < 3).length,
          belowExpectation: data.scores.filter((s) => s < 2).length,
        },
      };
    });

    return successResponse({ learningAreas });
  } catch (err) {
    return errorResponse(
      err instanceof Error ? err.message : "Failed to load learning area results.",
      500
    );
  }
});
