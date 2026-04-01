// app/api/assessments/trends/route.ts
// ============================================================
// GET /api/assessments/trends - Get performance trends over time
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
import { mapScoreToLevel, determineTrend } from "@/features/assessments";

const querySchema = z.object({
  studentId: z.string().uuid().optional(),
  classId: z.string().uuid().optional(),
  academicYearId: z.string().uuid(),
  learningAreaId: z.string().uuid().optional(),
});

export const GET = withAuth(async (request: NextRequest, { user }) => {
  const { searchParams } = new URL(request.url);
  const validation = validateQuery(searchParams, querySchema);

  if (!validation.success) {
    return validationErrorResponse(validation.errors!);
  }

  const { studentId, classId, academicYearId, learningAreaId } = validation.data!;

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

    if (!terms || terms.length === 0) {
      return successResponse({ trends: [], message: "No terms found for this academic year." });
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
    if (learningAreaId) {
      query = query.eq("learning_area_id", learningAreaId);
    }

    const { data: assessments, error } = await query;

    if (error) {
      return errorResponse(`Failed to load assessments: ${error.message}`, 500);
    }

    if (!assessments || assessments.length === 0) {
      return successResponse({ trends: [], message: "No assessments found." });
    }

    // Group by learning area and term
    const laTermMap = new Map<
      string,
      {
        learningAreaId: string;
        learningAreaName: string;
        termScores: Map<string, number[]>;
      }
    >();

    for (const assessment of assessments) {
      const la = (assessment as any).learning_areas;
      if (!la) continue;

      const laKey = la.learning_area_id;
      if (!laTermMap.has(laKey)) {
        laTermMap.set(laKey, {
          learningAreaId: la.learning_area_id,
          learningAreaName: la.name,
          termScores: new Map(),
        });
      }

      const entry = laTermMap.get(laKey)!;
      if (!entry.termScores.has(assessment.term_id)) {
        entry.termScores.set(assessment.term_id, []);
      }
      entry.termScores.get(assessment.term_id)!.push(assessment.score);
    }

    const trends = Array.from(laTermMap.entries()).map(([laId, data]) => {
      const termAverages = terms.map((term) => {
        const scores = data.termScores.get(term.term_id);
        if (!scores || scores.length === 0) {
          return {
            termId: term.term_id,
            termName: term.name,
            averageScore: null,
            level: null,
          };
        }
        const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
        return {
          termId: term.term_id,
          termName: term.name,
          averageScore: Math.round(avg * 100) / 100,
          level: mapScoreToLevel(avg),
        };
      }).filter((t) => t.averageScore !== null);

      // Calculate overall trend
      let trend = "stable";
      let percentageChange = 0;

      if (termAverages.length >= 2) {
        const first = termAverages[0].averageScore!;
        const last = termAverages[termAverages.length - 1].averageScore!;
        percentageChange = Math.round(((last - first) / first) * 100 * 100) / 100;
        trend = determineTrend(last, first);
      }

      return {
        learningAreaId: data.learningAreaId,
        learningAreaName: data.learningAreaName,
        terms: termAverages,
        trend,
        percentageChange,
      };
    });

    return successResponse({ trends });
  } catch (err) {
    return errorResponse(
      err instanceof Error ? err.message : "Failed to load trends.",
      500
    );
  }
});
