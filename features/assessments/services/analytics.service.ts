// @ts-nocheck
// features/assessments/services/analytics.service.ts
// ============================================================
// Analytics & Trends service
// Calculates performance trends over time
// Provides class-level and learning area analytics
// Supports dashboard visualizations
// ============================================================

import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { AuthUser } from "@/types/auth";
import type {
  StudentAnalytics,
  TrendData,
  TrendDirection,
  ClassPerformanceSummary,
  LearningAreaAnalytics,
  PerformanceLevelLabel,
} from "../types";
import type { AnalyticsFiltersInput } from "../validators/assessment.schema";
import { mapScoreToLevel } from "./performanceLevels.service";

// ============================================================
// DETERMINE TREND DIRECTION
// ============================================================
export function determineTrend(
  currentScore: number,
  previousScore: number | null,
): TrendDirection {
  if (previousScore === null) return "stable";

  const diff = currentScore - previousScore;

  if (diff > 0.25) return "improving";
  if (diff < -0.25) return "declining";
  return "stable";
}

// ============================================================
// CALCULATE STUDENT TRENDS (across terms)
// ============================================================
export async function calculateStudentTrends(
  studentId: string,
  academicYearId: string,
  currentUser: AuthUser,
): Promise<TrendData[]> {
  const supabase = await createSupabaseServerClient();
  const schoolId = currentUser.schoolId!;

  // Get all terms for this year
  const { data: terms } = await supabase
    .from("terms")
    .select("term_id, name")
    .eq("academic_year_id", academicYearId)
    .eq("school_id", schoolId)
    .order("name", { ascending: true });

  if (!terms || terms.length === 0) return [];

  // Get academic year info
  const { data: academicYear } = await supabase
    .from("academic_years")
    .select("year")
    .eq("academic_year_id", academicYearId)
    .single();

  // Get all assessments for this student this year
  const { data: assessments } = await supabase
    .from("assessments")
    .select(
      `
      score,
      term_id,
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

  // Group by learning area
  const laMap = new Map<
    string,
    {
      id: string;
      name: string;
      termScores: Map<string, number[]>;
    }
  >();

  for (const assessment of assessments) {
    const la = assessment.learning_areas as any;
    if (!la) continue;

    if (!laMap.has(la.learning_area_id)) {
      laMap.set(la.learning_area_id, {
        id: la.learning_area_id,
        name: la.name,
        termScores: new Map(),
      });
    }

    const laEntry = laMap.get(la.learning_area_id)!;

    if (!laEntry.termScores.has(assessment.term_id)) {
      laEntry.termScores.set(assessment.term_id, []);
    }

    laEntry.termScores.get(assessment.term_id)!.push(assessment.score);
  }

  // Calculate trends
  const trends: TrendData[] = [];

  for (const [, laData] of laMap) {
    const termAverages: {
      termId: string;
      termName: string;
      academicYear: string;
      averageScore: number;
      level: PerformanceLevelLabel;
    }[] = [];

    for (const term of terms) {
      const scores = laData.termScores.get(term.term_id);
      if (scores && scores.length > 0) {
        const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
        termAverages.push({
          termId: term.term_id,
          termName: term.name,
          academicYear: academicYear?.year || "",
          averageScore: Math.round(avg * 100) / 100,
          level: mapScoreToLevel(avg),
        });
      }
    }

    // Calculate overall trend
    let trend: TrendDirection = "stable";
    let percentageChange = 0;

    if (termAverages.length >= 2) {
      const first = termAverages[0].averageScore;
      const last = termAverages[termAverages.length - 1].averageScore;
      percentageChange = Math.round(((last - first) / first) * 100 * 100) / 100;

      trend = determineTrend(last, first);
    }

    trends.push({
      learningAreaId: laData.id,
      learningAreaName: laData.name,
      terms: termAverages,
      trend,
      percentageChange,
    });
  }

  return trends;
}

// ============================================================
// GET CLASS PERFORMANCE SUMMARY
// ============================================================
export async function getClassPerformanceSummary(
  classId: string,
  termId: string,
  academicYearId: string,
  currentUser: AuthUser,
): Promise<ClassPerformanceSummary | null> {
  const supabase = await createSupabaseServerClient();
  const schoolId = currentUser.schoolId!;

  // Get class info
  const { data: classInfo } = await supabase
    .from("classes")
    .select("class_id, name")
    .eq("class_id", classId)
    .single();

  if (!classInfo) return null;

  // Get all students in the class
  const { data: studentClasses } = await supabase
    .from("student_classes")
    .select(
      `
      student_id,
      students (
        first_name,
        last_name
      )
    `,
    )
    .eq("class_id", classId)
    .eq("academic_year_id", academicYearId)
    .eq("term_id", termId)
    .eq("school_id", schoolId)
    .eq("status", "active");

  if (!studentClasses || studentClasses.length === 0) {
    return {
      classId: classInfo.class_id,
      className: classInfo.name,
      totalStudents: 0,
      averageScore: 0,
      levelDistribution: {
        exceeding: 0,
        meeting: 0,
        approaching: 0,
        belowExpectation: 0,
      },
      topPerformers: [],
      needsSupport: [],
    };
  }

  // Get all assessments for these students
  const studentIds = studentClasses.map((sc: any) => sc.student_id);

  const { data: assessments } = await supabase
    .from("assessments")
    .select("student_id, score")
    .in("student_id", studentIds)
    .eq("term_id", termId)
    .eq("academic_year_id", academicYearId)
    .eq("school_id", schoolId);

  // Calculate per-student averages
  const studentAverages: {
    studentId: string;
    studentName: string;
    averageScore: number;
  }[] = [];
  const allScores: number[] = [];

  for (const sc of studentClasses) {
    const studentAssessments = (assessments || []).filter(
      (a: any) => a.student_id === sc.student_id,
    );

    if (studentAssessments.length > 0) {
      const scores = studentAssessments.map((a: any) => a.score);
      const avg =
        scores.reduce((a: number, b: number) => a + b, 0) / scores.length;

      studentAverages.push({
        studentId: sc.student_id,
        studentName: sc.students
          ? `${sc.students.first_name} ${sc.students.last_name}`
          : "Unknown",
        averageScore: Math.round(avg * 100) / 100,
      });

      allScores.push(...scores);
    }
  }

  // Calculate class average
  const classAverage =
    allScores.length > 0
      ? allScores.reduce((a, b) => a + b, 0) / allScores.length
      : 0;

  // Calculate level distribution
  const levelDistribution = {
    exceeding: allScores.filter((s) => s === 4).length,
    meeting: allScores.filter((s) => s === 3).length,
    approaching: allScores.filter((s) => s === 2).length,
    belowExpectation: allScores.filter((s) => s === 1).length,
  };

  // Get top 5 performers
  const sorted = [...studentAverages].sort(
    (a, b) => b.averageScore - a.averageScore,
  );
  const topPerformers = sorted.slice(0, 5);
  const needsSupport = sorted.filter((s) => s.averageScore < 2).slice(0, 5);

  return {
    classId: classInfo.class_id,
    className: classInfo.name,
    totalStudents: studentClasses.length,
    averageScore: Math.round(classAverage * 100) / 100,
    levelDistribution,
    topPerformers,
    needsSupport,
  };
}

// ============================================================
// GET LEARNING AREA ANALYTICS FOR CLASS
// ============================================================
export async function getLearningAreaAnalytics(
  classId: string,
  learningAreaId: string,
  termId: string,
  academicYearId: string,
  currentUser: AuthUser,
): Promise<LearningAreaAnalytics | null> {
  const supabase = await createSupabaseServerClient();
  const schoolId = currentUser.schoolId!;

  // Get learning area info
  const { data: la } = await supabase
    .from("learning_areas")
    .select("learning_area_id, name")
    .eq("learning_area_id", learningAreaId)
    .single();

  if (!la) return null;

  // Get all assessments for this class and learning area
  const { data: assessments } = await supabase
    .from("assessments")
    .select(
      `
      score,
      student_id,
      competency_id,
      competencies (
        sub_strand_id,
        sub_strands (
          strand_id,
          strands (
            strand_id,
            name
          )
        )
      )
    `,
    )
    .eq("class_id", classId)
    .eq("learning_area_id", learningAreaId)
    .eq("term_id", termId)
    .eq("academic_year_id", academicYearId)
    .eq("school_id", schoolId);

  if (!assessments || assessments.length === 0) {
    return {
      learningAreaId: la.learning_area_id,
      learningAreaName: la.name,
      classAverage: 0,
      studentCount: 0,
      levelDistribution: {
        exceeding: 0,
        meeting: 0,
        approaching: 0,
        belowExpectation: 0,
      },
      strandPerformance: [],
    };
  }

  const scores = assessments.map((a: any) => a.score);
  const uniqueStudents = new Set(assessments.map((a: any) => a.student_id));

  const classAverage =
    scores.reduce((a: number, b: number) => a + b, 0) / scores.length;

  const levelDistribution = {
    exceeding: scores.filter((s: number) => s === 4).length,
    meeting: scores.filter((s: number) => s === 3).length,
    approaching: scores.filter((s: number) => s === 2).length,
    belowExpectation: scores.filter((s: number) => s === 1).length,
  };

  // Calculate strand performance
  const strandMap = new Map<string, { name: string; scores: number[] }>();

  for (const assessment of assessments) {
    const strand = (assessment.competencies as any)?.sub_strands?.strands;
    if (!strand) continue;

    if (!strandMap.has(strand.strand_id)) {
      strandMap.set(strand.strand_id, { name: strand.name, scores: [] });
    }
    strandMap.get(strand.strand_id)!.scores.push(assessment.score);
  }

  const strandPerformance = Array.from(strandMap.entries()).map(
    ([strandId, data]) => ({
      strandId,
      strandName: data.name,
      averageScore:
        Math.round(
          (data.scores.reduce((a, b) => a + b, 0) / data.scores.length) * 100,
        ) / 100,
    }),
  );

  return {
    learningAreaId: la.learning_area_id,
    learningAreaName: la.name,
    classAverage: Math.round(classAverage * 100) / 100,
    studentCount: uniqueStudents.size,
    levelDistribution,
    strandPerformance,
  };
}

// ============================================================
// GET TEACHER PERFORMANCE SUMMARY
// ============================================================
export async function getTeacherPerformanceSummary(
  teacherUserId: string,
  academicYearId: string,
  termId: string,
  currentUser: AuthUser,
): Promise<{
  classesCount: number;
  studentsCount: number;
  averageScore: number;
  learningAreas: { name: string; average: number }[];
}> {
  const supabase = await createSupabaseServerClient();
  const schoolId = currentUser.schoolId!;

  // Get all assessments by this teacher
  const { data: assessments } = await supabase
    .from("assessments")
    .select(
      `
      score,
      student_id,
      class_id,
      learning_area_id,
      learning_areas (
        name
      )
    `,
    )
    .eq("assessed_by", teacherUserId)
    .eq("academic_year_id", academicYearId)
    .eq("term_id", termId)
    .eq("school_id", schoolId);

  if (!assessments || assessments.length === 0) {
    return {
      classesCount: 0,
      studentsCount: 0,
      averageScore: 0,
      learningAreas: [],
    };
  }

  const uniqueClasses = new Set(assessments.map((a: any) => a.class_id));
  const uniqueStudents = new Set(assessments.map((a: any) => a.student_id));
  const scores = assessments.map((a: any) => a.score);
  const avgScore =
    scores.reduce((a: number, b: number) => a + b, 0) / scores.length;

  // Group by learning area
  const laMap = new Map<string, { name: string; scores: number[] }>();

  for (const assessment of assessments) {
    const la = assessment.learning_areas as any;
    if (!la) continue;

    if (!laMap.has(assessment.learning_area_id)) {
      laMap.set(assessment.learning_area_id, { name: la.name, scores: [] });
    }
    laMap.get(assessment.learning_area_id)!.scores.push(assessment.score);
  }

  const learningAreas = Array.from(laMap.values()).map((data) => ({
    name: data.name,
    average:
      Math.round(
        (data.scores.reduce((a, b) => a + b, 0) / data.scores.length) * 100,
      ) / 100,
  }));

  return {
    classesCount: uniqueClasses.size,
    studentsCount: uniqueStudents.size,
    averageScore: Math.round(avgScore * 100) / 100,
    learningAreas,
  };
}

// ============================================================
// GET SCHOOL-WIDE PERFORMANCE DASHBOARD DATA
// ============================================================
export async function getSchoolPerformanceDashboard(
  academicYearId: string,
  termId: string,
  currentUser: AuthUser,
): Promise<{
  totalStudents: number;
  totalAssessments: number;
  schoolAverage: number;
  levelDistribution: {
    exceeding: number;
    meeting: number;
    approaching: number;
    belowExpectation: number;
  };
  topLearningAreas: { name: string; average: number }[];
  lowPerformingAreas: { name: string; average: number }[];
}> {
  const supabase = await createSupabaseServerClient();
  const schoolId = currentUser.schoolId!;

  const { data: assessments } = await supabase
    .from("assessments")
    .select(
      `
      score,
      student_id,
      learning_area_id,
      learning_areas (
        name
      )
    `,
    )
    .eq("academic_year_id", academicYearId)
    .eq("term_id", termId)
    .eq("school_id", schoolId);

  if (!assessments || assessments.length === 0) {
    return {
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
    };
  }

  const scores = assessments.map((a: any) => a.score);
  const uniqueStudents = new Set(assessments.map((a: any) => a.student_id));
  const schoolAverage =
    scores.reduce((a: number, b: number) => a + b, 0) / scores.length;

  const levelDistribution = {
    exceeding: scores.filter((s: number) => s === 4).length,
    meeting: scores.filter((s: number) => s === 3).length,
    approaching: scores.filter((s: number) => s === 2).length,
    belowExpectation: scores.filter((s: number) => s === 1).length,
  };

  // Group by learning area
  const laMap = new Map<string, { name: string; scores: number[] }>();

  for (const assessment of assessments) {
    const la = assessment.learning_areas as any;
    if (!la) continue;

    if (!laMap.has(assessment.learning_area_id)) {
      laMap.set(assessment.learning_area_id, { name: la.name, scores: [] });
    }
    laMap.get(assessment.learning_area_id)!.scores.push(assessment.score);
  }

  const laAverages = Array.from(laMap.values())
    .map((data) => ({
      name: data.name,
      average:
        Math.round(
          (data.scores.reduce((a, b) => a + b, 0) / data.scores.length) * 100,
        ) / 100,
    }))
    .sort((a, b) => b.average - a.average);

  return {
    totalStudents: uniqueStudents.size,
    totalAssessments: assessments.length,
    schoolAverage: Math.round(schoolAverage * 100) / 100,
    levelDistribution,
    topLearningAreas: laAverages.slice(0, 5),
    lowPerformingAreas: laAverages.slice(-5).reverse(),
  };
}
