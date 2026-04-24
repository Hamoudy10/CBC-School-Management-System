export const dynamic = 'force-dynamic';

// app/api/assessments/year-results/route.ts
// ============================================================
// GET /api/assessments/year-results - Get yearly aggregated results
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
  academicYearId: z.string().uuid(),
});

export const GET = withAuth(async (request: NextRequest, { user }) => {
  const { searchParams } = new URL(request.url);
  const validation = validateQuery(searchParams, querySchema);

  if (!validation.success) {
    return validationErrorResponse(validation.errors!);
  }

  const { studentId, classId, academicYearId } = validation.data!;

  if (!studentId && !classId) {
    return errorResponse("Either studentId or classId is required.", 400);
  }

  try {
    const supabase = await createSupabaseServerClient();

    if (!user.schoolId) {
      return errorResponse("School context is required.", 400);
    }

    // Get all terms for this academic year
    const { data: terms, error: termsError } = await supabase
      .from("terms")
      .select("term_id, name")
      .eq("academic_year_id", academicYearId)
      .eq("school_id", user.schoolId)
      .order("name", { ascending: true });

    if (termsError) {
      return errorResponse(`Failed to load terms: ${termsError.message}`, 500);
    }

    // Get all assessments for the year
    let query = supabase
      .from("assessments")
      .select(
        `
        score,
        student_id,
        term_id,
        learning_area_id,
        learning_areas (
          learning_area_id,
          name
        )
      `
      )
      .eq("academic_year_id", academicYearId)
      .eq("school_id", user.schoolId);

    if (studentId) {
      query = query.eq("student_id", studentId);
    }
    if (classId) {
      query = query.eq("class_id", classId);
    }

    const { data: assessments, error } = await query;

    if (error) {
      return errorResponse(`Failed to load assessments: ${error.message}`, 500);
    }

    if (!assessments || assessments.length === 0) {
      return successResponse({ yearSummary: null, termBreakdown: [], message: "No assessments found for this year." });
    }

    // Group by term
    const termMap = new Map<string, { termId: string; termName: string; scores: number[]; laScores: Map<string, number[]> }>();
    const overallScores: number[] = [];

    for (const assessment of assessments) {
      const la = (assessment as any).learning_areas;
      if (!la) {
        continue;
      }

      const termKey = assessment.term_id;
      if (!termMap.has(termKey)) {
        const termInfo = terms?.find((t) => t.term_id === termKey);
        termMap.set(termKey, {
          termId: termKey,
          termName: termInfo?.name || "Unknown Term",
          scores: [],
          laScores: new Map(),
        });
      }

      const termEntry = termMap.get(termKey)!;
      termEntry.scores.push(assessment.score);
      overallScores.push(assessment.score);

      const laKey = la.learning_area_id;
      if (!termEntry.laScores.has(laKey)) {
        termEntry.laScores.set(laKey, []);
      }
      termEntry.laScores.get(laKey)!.push(assessment.score);
    }

    const termBreakdown = Array.from(termMap.entries()).map(([termId, data]) => {
      const avg = data.scores.reduce((a, b) => a + b, 0) / data.scores.length;
      const laBreakdown = Array.from(data.laScores.entries()).map(([laId, scores]) => {
        const laAvg = scores.reduce((a, b) => a + b, 0) / scores.length;
        return {
          learningAreaId: laId,
          averageScore: Math.round(laAvg * 100) / 100,
          level: mapScoreToLevel(laAvg),
        };
      });

      return {
        termId: data.termId,
        termName: data.termName,
        averageScore: Math.round(avg * 100) / 100,
        level: mapScoreToLevel(avg),
        assessmentCount: data.scores.length,
        learningAreas: laBreakdown,
      };
    });

    const overallAvg = overallScores.reduce((a, b) => a + b, 0) / overallScores.length;

    const yearSummary = {
      academicYearId,
      overallAverage: Math.round(overallAvg * 100) / 100,
      overallLevel: mapScoreToLevel(overallAvg),
      totalAssessments: overallScores.length,
      termCount: termBreakdown.length,
      termBreakdown: termBreakdown.map((t) => ({
        termName: t.termName,
        averageScore: t.averageScore,
        level: t.level,
      })),
    };

    return successResponse({ yearSummary, termBreakdown });
  } catch (err) {
    return errorResponse(
      err instanceof Error ? err.message : "Failed to load year results.",
      500
    );
  }
});
