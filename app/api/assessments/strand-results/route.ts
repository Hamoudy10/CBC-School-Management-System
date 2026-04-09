export const dynamic = 'force-dynamic';

// app/api/assessments/strand-results/route.ts
// ============================================================
// GET /api/assessments/strand-results - Get strand-level aggregation for a student
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
  studentId: z.string().uuid(),
  termId: z.string().uuid(),
  academicYearId: z.string().uuid(),
});

export const GET = withAuth(async (request: NextRequest, { user }) => {
  const { searchParams } = new URL(request.url);
  const validation = validateQuery(searchParams, querySchema);

  if (!validation.success) {
    return validationErrorResponse(validation.errors!);
  }

  const { studentId, termId, academicYearId } = validation.data!;

  try {
    const supabase = await createSupabaseServerClient();

    if (!user.schoolId) {
      return errorResponse("School context is required.", 400);
    }

    // Fetch all assessments for this student, term, year with full hierarchy
    const { data: assessments, error } = await supabase
      .from("assessments")
      .select(
        `
        score,
        competency_id,
        competencies (
          competency_id,
          name,
          sub_strand_id,
          sub_strands (
            sub_strand_id,
            name,
            strand_id,
            strands (
              strand_id,
              name,
              learning_area_id,
              learning_areas (
                learning_area_id,
                name
              )
            )
          )
        )
      `
      )
      .eq("student_id", studentId)
      .eq("term_id", termId)
      .eq("academic_year_id", academicYearId)
      .eq("school_id", user.schoolId);

    if (error) {
      return errorResponse(`Failed to load assessments: ${error.message}`, 500);
    }

    if (!assessments || assessments.length === 0) {
      return successResponse({ strands: [], message: "No assessments found for this student in the selected term." });
    }

    // Build strand-level aggregation
    const strandMap = new Map<
      string,
      {
        strandId: string;
        strandName: string;
        learningAreaId: string;
        learningAreaName: string;
        scores: number[];
        subStrands: Map<
          string,
          {
            subStrandId: string;
            subStrandName: string;
            scores: number[];
            competencies: Map<string, { name: string; score: number }>;
          }
        >;
      }
    >();

    for (const assessment of assessments) {
      const competency = (assessment as any).competencies;
      if (!competency) continue;

      const subStrand = competency.sub_strands;
      if (!subStrand) continue;

      const strand = subStrand.strands;
      if (!strand) continue;

      const learningArea = strand.learning_areas;
      if (!learningArea) continue;

      const strandKey = strand.strand_id;
      if (!strandMap.has(strandKey)) {
        strandMap.set(strandKey, {
          strandId: strand.strand_id,
          strandName: strand.name,
          learningAreaId: learningArea.learning_area_id,
          learningAreaName: learningArea.name,
          scores: [],
          subStrands: new Map(),
        });
      }

      const strandEntry = strandMap.get(strandKey)!;
      strandEntry.scores.push(assessment.score);

      const subStrandKey = subStrand.sub_strand_id;
      if (!strandEntry.subStrands.has(subStrandKey)) {
        strandEntry.subStrands.set(subStrandKey, {
          subStrandId: subStrand.sub_strand_id,
          subStrandName: subStrand.name,
          scores: [],
          competencies: new Map(),
        });
      }

      const ssEntry = strandEntry.subStrands.get(subStrandKey)!;
      ssEntry.scores.push(assessment.score);
      ssEntry.competencies.set(competency.competency_id, {
        name: competency.name,
        score: assessment.score,
      });
    }

    const strands = Array.from(strandMap.entries()).map(([strandId, data]) => {
      const strandAvg = data.scores.reduce((a, b) => a + b, 0) / data.scores.length;

      const subStrands = Array.from(data.subStrands.entries()).map(([ssId, ssData]) => {
        const ssAvg = ssData.scores.reduce((a, b) => a + b, 0) / ssData.scores.length;
        return {
          subStrandId: ssData.subStrandId,
          subStrandName: ssData.subStrandName,
          averageScore: Math.round(ssAvg * 100) / 100,
          level: mapScoreToLevel(ssAvg),
          competencyCount: ssData.competencies.size,
          competencies: Array.from(ssData.competencies.values()),
        };
      });

      return {
        strandId: data.strandId,
        strandName: data.strandName,
        learningAreaId: data.learningAreaId,
        learningAreaName: data.learningAreaName,
        averageScore: Math.round(strandAvg * 100) / 100,
        level: mapScoreToLevel(strandAvg),
        competencyCount: data.scores.length,
        subStrands,
      };
    });

    return successResponse({ strands });
  } catch (err) {
    return errorResponse(
      err instanceof Error ? err.message : "Failed to load strand results.",
      500
    );
  }
});
