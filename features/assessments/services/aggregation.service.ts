// features/assessments/services/aggregation.service.ts
// ============================================================
// Assessment Aggregation service
// Calculates term-wise and yearly averages
// Builds hierarchical summaries: Competency → Sub-Strand → Strand → Learning Area
// ============================================================

import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { AuthUser } from "@/types/auth";
import type {
  AssessmentAggregate,
  LearningAreaSummary,
  StrandSummary,
  SubStrandSummary,
  CompetencyScore,
  PerformanceLevelLabel,
} from "../types";
import { mapScoreToLevel } from "./performanceLevels.service";

// ============================================================
// GET ASSESSMENT AGGREGATES FOR A STUDENT (precomputed)
// ============================================================
export async function getStudentAggregates(
  studentId: string,
  academicYearId: string,
  termId: string,
  currentUser: AuthUser,
): Promise<AssessmentAggregate[]> {
  const supabase = await createSupabaseServerClient();

  let query = supabase
    .from("assessment_aggregates")
    .select(
      `
      *,
      learning_areas (
        name
      )
    `,
    )
    .eq("student_id", studentId)
    .eq("academic_year_id", academicYearId)
    .eq("term_id", termId);

  if (currentUser.role !== "super_admin") {
    query = query.eq("school_id", currentUser.schoolId!);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Failed to get aggregates: ${error.message}`);
  }

  return (data || []).map((row: any) => ({
    id: row.id,
    schoolId: row.school_id,
    studentId: row.student_id,
    learningAreaId: row.learning_area_id,
    learningAreaName: row.learning_areas?.name || null,
    classId: row.class_id,
    academicYearId: row.academic_year_id,
    termId: row.term_id,
    totalCompetencies: row.total_competencies,
    averageScore: parseFloat(row.average_score),
    overallLevel: row.overall_level as PerformanceLevelLabel,
    exceedingCount: row.exceeding_count,
    meetingCount: row.meeting_count,
    approachingCount: row.approaching_count,
    belowExpectationCount: row.below_expectation_count,
    computedAt: row.computed_at,
  }));
}

// ============================================================
// CALCULATE LEARNING AREA SUMMARY (hierarchical breakdown)
// Aggregates: Competencies → Sub-Strands → Strands → Learning Area
// ============================================================
export async function calculateLearningAreaSummary(
  studentId: string,
  learningAreaId: string,
  termId: string,
  academicYearId: string,
  currentUser: AuthUser,
): Promise<LearningAreaSummary | null> {
  const supabase = await createSupabaseServerClient();
  const schoolId = currentUser.schoolId!;

  // Get learning area info
  const { data: la } = await supabase
    .from("learning_areas")
    .select("learning_area_id, name")
    .eq("learning_area_id", learningAreaId)
    .single();

  if (!la) return null;

  // Get all assessments for this student, learning area, term
  const { data: assessments } = await supabase
    .from("assessments")
    .select(
      `
      assessment_id,
      score,
      remarks,
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
            name
          )
        )
      )
    `,
    )
    .eq("student_id", studentId)
    .eq("learning_area_id", learningAreaId)
    .eq("term_id", termId)
    .eq("academic_year_id", academicYearId)
    .eq("school_id", schoolId);

  if (!assessments || assessments.length === 0) {
    return {
      learningAreaId: la.learning_area_id,
      learningAreaName: la.name,
      averageScore: 0,
      level: "below_expectation",
      competencyCount: 0,
      strandSummaries: [],
    };
  }

  // Build hierarchy
  const strandMap = new Map<
    string,
    {
      strandId: string;
      strandName: string;
      subStrands: Map<
        string,
        {
          subStrandId: string;
          subStrandName: string;
          competencies: CompetencyScore[];
        }
      >;
    }
  >();

  for (const assessment of assessments) {
    const competency = assessment.competencies as any;
    if (!competency) continue;

    const subStrand = competency.sub_strands;
    if (!subStrand) continue;

    const strand = subStrand.strands;
    if (!strand) continue;

    // Get or create strand entry
    if (!strandMap.has(strand.strand_id)) {
      strandMap.set(strand.strand_id, {
        strandId: strand.strand_id,
        strandName: strand.name,
        subStrands: new Map(),
      });
    }
    const strandEntry = strandMap.get(strand.strand_id)!;

    // Get or create sub-strand entry
    if (!strandEntry.subStrands.has(subStrand.sub_strand_id)) {
      strandEntry.subStrands.set(subStrand.sub_strand_id, {
        subStrandId: subStrand.sub_strand_id,
        subStrandName: subStrand.name,
        competencies: [],
      });
    }
    const subStrandEntry = strandEntry.subStrands.get(subStrand.sub_strand_id)!;

    // Add competency score
    subStrandEntry.competencies.push({
      competencyId: competency.competency_id,
      competencyName: competency.name,
      score: assessment.score,
      level: mapScoreToLevel(assessment.score),
      remarks: assessment.remarks,
    });
  }

  // Calculate averages and build summaries
  const strandSummaries: StrandSummary[] = [];
  let totalScoreSum = 0;
  let totalCount = 0;

  for (const [, strandData] of strandMap) {
    const subStrandSummaries: SubStrandSummary[] = [];
    let strandScoreSum = 0;
    let strandCount = 0;

    for (const [, ssData] of strandData.subStrands) {
      const ssScores = ssData.competencies.map((c) => c.score);
      const ssAvg = ssScores.reduce((a, b) => a + b, 0) / ssScores.length;

      subStrandSummaries.push({
        subStrandId: ssData.subStrandId,
        subStrandName: ssData.subStrandName,
        averageScore: Math.round(ssAvg * 100) / 100,
        level: mapScoreToLevel(ssAvg),
        competencies: ssData.competencies,
      });

      strandScoreSum += ssScores.reduce((a, b) => a + b, 0);
      strandCount += ssScores.length;
    }

    const strandAvg = strandCount > 0 ? strandScoreSum / strandCount : 0;

    strandSummaries.push({
      strandId: strandData.strandId,
      strandName: strandData.strandName,
      averageScore: Math.round(strandAvg * 100) / 100,
      level: mapScoreToLevel(strandAvg),
      subStrandSummaries,
    });

    totalScoreSum += strandScoreSum;
    totalCount += strandCount;
  }

  const overallAvg = totalCount > 0 ? totalScoreSum / totalCount : 0;

  return {
    learningAreaId: la.learning_area_id,
    learningAreaName: la.name,
    averageScore: Math.round(overallAvg * 100) / 100,
    level: mapScoreToLevel(overallAvg),
    competencyCount: totalCount,
    strandSummaries,
  };
}

// ============================================================
// CALCULATE ALL LEARNING AREA SUMMARIES FOR A STUDENT
// ============================================================
export async function calculateAllLearningAreaSummaries(
  studentId: string,
  termId: string,
  academicYearId: string,
  currentUser: AuthUser,
): Promise<LearningAreaSummary[]> {
  const supabase = await createSupabaseServerClient();
  const schoolId = currentUser.schoolId!;

  // Get distinct learning areas the student has assessments in
  const { data: laIds } = await supabase
    .from("assessments")
    .select("learning_area_id")
    .eq("student_id", studentId)
    .eq("term_id", termId)
    .eq("academic_year_id", academicYearId)
    .eq("school_id", schoolId);

  if (!laIds || laIds.length === 0) return [];

  const uniqueLaIds = [...new Set(laIds.map((r: any) => r.learning_area_id))];

  const summaries: LearningAreaSummary[] = [];

  for (const laId of uniqueLaIds) {
    const summary = await calculateLearningAreaSummary(
      studentId,
      laId,
      termId,
      academicYearId,
      currentUser,
    );
    if (summary) {
      summaries.push(summary);
    }
  }

  return summaries;
}

// ============================================================
// CALCULATE YEARLY SUMMARY (aggregate all 3 terms)
// ============================================================
export async function calculateYearlySummary(
  studentId: string,
  academicYearId: string,
  currentUser: AuthUser,
): Promise<LearningAreaSummary[]> {
  const supabase = await createSupabaseServerClient();
  const schoolId = currentUser.schoolId!;

  // Get all terms for this academic year
  const { data: terms } = await supabase
    .from("terms")
    .select("term_id, name")
    .eq("academic_year_id", academicYearId)
    .eq("school_id", schoolId)
    .order("name", { ascending: true });

  if (!terms || terms.length === 0) return [];

  // Get all assessments across all terms
  const { data: assessments } = await supabase
    .from("assessments")
    .select(
      `
      score,
      learning_area_id,
      learning_areas (
        learning_area_id,
        name
      )
    `,
    )
    .eq("student_id", studentId)
    .eq("academic_year_id", academicYearId)
    .eq("school_id", schoolId);

  if (!assessments || assessments.length === 0) return [];

  // Group by learning area and calculate yearly average
  const laMap = new Map<
    string,
    {
      id: string;
      name: string;
      scores: number[];
    }
  >();

  for (const assessment of assessments) {
    const la = assessment.learning_areas as any;
    if (!la) continue;

    if (!laMap.has(la.learning_area_id)) {
      laMap.set(la.learning_area_id, {
        id: la.learning_area_id,
        name: la.name,
        scores: [],
      });
    }
    laMap.get(la.learning_area_id)!.scores.push(assessment.score);
  }

  const summaries: LearningAreaSummary[] = [];

  for (const [, laData] of laMap) {
    const avg = laData.scores.reduce((a, b) => a + b, 0) / laData.scores.length;

    summaries.push({
      learningAreaId: laData.id,
      learningAreaName: laData.name,
      averageScore: Math.round(avg * 100) / 100,
      level: mapScoreToLevel(avg),
      competencyCount: laData.scores.length,
      strandSummaries: [], // Yearly view doesn't break down by strand
    });
  }

  return summaries;
}

// ============================================================
// CALCULATE OVERALL STUDENT PERFORMANCE
// ============================================================
export async function calculateOverallStudentPerformance(
  studentId: string,
  termId: string,
  academicYearId: string,
  currentUser: AuthUser,
): Promise<{
  totalCompetencies: number;
  assessedCompetencies: number;
  averageScore: number;
  overallLevel: PerformanceLevelLabel;
  levelDistribution: {
    exceeding: number;
    meeting: number;
    approaching: number;
    belowExpectation: number;
  };
}> {
  const supabase = await createSupabaseServerClient();
  const schoolId = currentUser.schoolId!;

  const { data: assessments } = await supabase
    .from("assessments")
    .select("score")
    .eq("student_id", studentId)
    .eq("term_id", termId)
    .eq("academic_year_id", academicYearId)
    .eq("school_id", schoolId);

  if (!assessments || assessments.length === 0) {
    return {
      totalCompetencies: 0,
      assessedCompetencies: 0,
      averageScore: 0,
      overallLevel: "below_expectation",
      levelDistribution: {
        exceeding: 0,
        meeting: 0,
        approaching: 0,
        belowExpectation: 0,
      },
    };
  }

  const scores = assessments.map((a: any) => a.score);
  const avg = scores.reduce((a: number, b: number) => a + b, 0) / scores.length;

  const distribution = {
    exceeding: scores.filter((s: number) => s === 4).length,
    meeting: scores.filter((s: number) => s === 3).length,
    approaching: scores.filter((s: number) => s === 2).length,
    belowExpectation: scores.filter((s: number) => s === 1).length,
  };

  return {
    totalCompetencies: scores.length, // In real scenario, compare against curriculum
    assessedCompetencies: scores.length,
    averageScore: Math.round(avg * 100) / 100,
    overallLevel: mapScoreToLevel(avg),
    levelDistribution: distribution,
  };
}
