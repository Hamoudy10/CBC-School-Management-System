// app/api/assessments/student/[id]/route.ts
// ============================================================
// GET /api/assessments/student/:id - Get all assessments for a specific student
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
  forbiddenResponse,
} from "@/lib/api/response";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { mapScoreToLevel } from "@/features/assessments/services/performanceLevels.service";

const querySchema = z.object({
  termId: z.string().uuid().optional(),
  academicYearId: z.string().uuid().optional(),
  learningAreaId: z.string().uuid().optional(),
  page: z.coerce.number().int().min(1).optional().default(1),
  pageSize: z.coerce.number().int().min(1).max(100).optional().default(50),
});

export const GET = withAuth(async (request: NextRequest, { user, params }) => {
  const studentId = params?.id;
  if (!studentId) {
    return notFoundResponse("Student ID required");
  }

  const idValidation = validateUuid(studentId);
  if (!idValidation.success) {
    return validationErrorResponse(idValidation.errors!);
  }

  // Access control: parents can only see their children, students can only see themselves
  try {
    const supabase = await createSupabaseServerClient();

    if (user.role === "parent") {
      const { data: guardianLinks } = await supabase
        .from("student_guardians")
        .select("student_id")
        .eq("guardian_user_id", user.id);

      const childIds = (guardianLinks ?? []).map((link: any) => link.student_id);
      if (!childIds.includes(studentId)) {
        return forbiddenResponse("Access denied: this student is not linked to your account.");
      }
    }

    if (user.role === "student") {
      const { data: studentRecord } = await supabase
        .from("students")
        .select("student_id")
        .eq("user_id", user.id)
        .maybeSingle();

      if ((studentRecord as any)?.student_id !== studentId) {
        return forbiddenResponse("Access denied: you can only view your own assessments.");
      }
    }

    const { searchParams } = new URL(request.url);
    const validation = validateQuery(searchParams, querySchema);

    if (!validation.success) {
      return validationErrorResponse(validation.errors!);
    }

    const { termId, academicYearId, learningAreaId, page, pageSize } = validation.data!;

    if (!user.schoolId) {
      return errorResponse("School context is required.", 400);
    }

    // Fetch student info
    const { data: student, error: studentError } = await supabase
      .from("students")
      .select("student_id, admission_number, first_name, last_name, current_class_id, classes(name)")
      .eq("student_id", studentId)
      .eq("school_id", user.schoolId)
      .maybeSingle();

    if (studentError || !student) {
      return notFoundResponse("Student not found.");
    }

    // Build assessments query
    let query = supabase
      .from("assessments")
      .select(
        `
        assessment_id,
        score,
        level_id,
        remarks,
        assessment_date,
        assessed_by,
        created_at,
        competency_id,
        learning_area_id,
        class_id,
        term_id,
        academic_year_id,
        competencies (
          competency_id,
          name,
          sub_strands (
            sub_strand_id,
            name,
            strands (
              strand_id,
              name,
              learning_areas (
                learning_area_id,
                name
              )
            )
          )
        ),
        learning_areas (
          learning_area_id,
          name
        ),
        terms (
          term_id,
          name
        ),
        academic_years (
          academic_year_id,
          year
        ),
        performance_levels (
          level_id,
          name,
          label
        )
      `,
        { count: "exact" }
      )
      .eq("student_id", studentId)
      .eq("school_id", user.schoolId);

    if (termId) {
      query = query.eq("term_id", termId);
    }
    if (academicYearId) {
      query = query.eq("academic_year_id", academicYearId);
    }
    if (learningAreaId) {
      query = query.eq("learning_area_id", learningAreaId);
    }

    const offset = (page - 1) * pageSize;
    const { data: assessments, error, count } = await query
      .order("assessment_date", { ascending: false })
      .range(offset, offset + pageSize - 1);

    if (error) {
      return errorResponse(`Failed to load assessments: ${error.message}`, 500);
    }

    // Calculate summary stats
    const allScores = (assessments ?? []).map((a: any) => a.score);
    const overallAvg = allScores.length > 0
      ? Math.round((allScores.reduce((a: number, b: number) => a + b, 0) / allScores.length) * 100) / 100
      : 0;

    // Group by learning area for summary
    const laSummaryMap = new Map<string, { name: string; scores: number[] }>();
    for (const assessment of assessments ?? []) {
      const la = (assessment as any).learning_areas;
      if (!la) {
        continue;
      }
      if (!laSummaryMap.has(la.learning_area_id)) {
        laSummaryMap.set(la.learning_area_id, { name: la.name, scores: [] });
      }
      laSummaryMap.get(la.learning_area_id)!.scores.push(assessment.score);
    }

    const learningAreaSummary = Array.from(laSummaryMap.entries()).map(([laId, data]) => {
      const avg = data.scores.reduce((a, b) => a + b, 0) / data.scores.length;
      return {
        learningAreaId: laId,
        learningAreaName: data.name,
        averageScore: Math.round(avg * 100) / 100,
        level: mapScoreToLevel(avg),
        assessmentCount: data.scores.length,
      };
    });

    const normalizedAssessments = (assessments ?? []).map((row: any) => {
      const competency = (row.competencies as any);
      const subStrand = competency?.sub_strands;
      const strand = subStrand?.strands;
      const learningArea = strand?.learning_areas;
      const term = Array.isArray(row.terms) ? row.terms[0] : row.terms;
      const academicYear = Array.isArray(row.academic_years) ? row.academic_years[0] : row.academic_years;
      const level = Array.isArray(row.performance_levels) ? row.performance_levels[0] : row.performance_levels;

      return {
        assessmentId: row.assessment_id,
        competencyId: row.competency_id,
        competencyName: competency?.name,
        subStrandName: subStrand?.name,
        strandName: strand?.name,
        learningAreaId: row.learning_area_id,
        learningAreaName: learningArea?.name || (row.learning_areas as any)?.name,
        score: row.score,
        levelId: row.level_id,
        levelName: level?.name,
        levelLabel: level?.label,
        remarks: row.remarks,
        assessmentDate: row.assessment_date,
        termId: row.term_id,
        termName: term?.name,
        academicYearId: row.academic_year_id,
        academicYear: academicYear?.year,
        createdAt: row.created_at,
      };
    });

    const studentClass = Array.isArray((student as any).classes)
      ? (student as any).classes[0]
      : (student as any).classes;

    return successResponse({
      student: {
        studentId: student.student_id,
        firstName: student.first_name,
        lastName: student.last_name,
        admissionNumber: student.admission_number,
        className: studentClass?.name,
      },
      summary: {
        overallAverage: overallAvg,
        overallLevel: mapScoreToLevel(overallAvg),
        totalAssessments: count ?? 0,
        learningAreaSummary,
      },
      assessments: normalizedAssessments,
      pagination: {
        page,
        pageSize,
        total: count ?? 0,
        totalPages: Math.max(1, Math.ceil((count ?? 0) / pageSize)),
      },
    });
  } catch (err) {
    return errorResponse(
      err instanceof Error ? err.message : "Failed to load student assessments.",
      500
    );
  }
});
