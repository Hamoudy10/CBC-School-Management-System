import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { generateGroqCompletion } from "@/lib/ai/groq.client";
import type { AuthUser } from "@/types/auth";
import type {
  ClassPerformanceResult,
  DropoutRiskResult,
  DropoutRiskStudent,
  SchoolHealthClassTrend,
  SchoolHealthResult,
  TrendDirection,
  AnalyticsAIResult,
} from "../types";
import type {
  ClassPerformanceRequestInput,
  DropoutRiskRequestInput,
  SchoolHealthRequestInput,
} from "../validators/analyticsAi.schema";

const dropoutRiskAiSchema = z.object({
  summary: z.string().min(1),
  students: z.array(
    z.object({
      studentId: z.string().uuid(),
      riskLevel: z.enum(["low", "medium", "high"]),
      reason: z.array(z.string().min(1)).min(1).max(5),
      recommendation: z.array(z.string().min(1)).min(1).max(5),
    }),
  ),
});

const classPerformanceAiSchema = z.object({
  summary: z.string().min(1),
  highlights: z.array(z.string().min(1)).min(2).max(8),
  recommendations: z.array(z.string().min(1)).min(2).max(8),
  teacherInsights: z.array(
    z.object({
      teacherId: z.string().uuid(),
      insight: z.string().min(1),
    }),
  ),
});

const schoolHealthAiSchema = z.object({
  schoolSummary: z.string().min(1),
  priorityActions: z.array(z.string().min(1)).min(2).max(8),
  watchList: z.array(z.string().min(1)).max(8),
});

type AcademicContext = {
  termId: string | null;
  academicYearId: string | null;
};

type RawClassRow = {
  class_id?: string;
  name?: string | null;
};

type RawStudentRow = {
  student_id?: string;
  first_name?: string | null;
  last_name?: string | null;
};

type RawAssessmentRow = {
  student_id?: string | null;
  class_id?: string | null;
  learning_area_id?: string | null;
  score?: number | string | null;
  assessment_date?: string | null;
  assessed_by?: string | null;
  learning_areas?: { name?: string | null } | Array<{ name?: string | null }> | null;
  classes?: { name?: string | null } | Array<{ name?: string | null }> | null;
};

type RawAttendanceRow = {
  student_id?: string | null;
  class_id?: string | null;
  status?: string | null;
};

type RawDisciplineRow = {
  student_id?: string | null;
  severity?: string | null;
};

type RawTeacherAssignmentRow = {
  teacher_id?: string | null;
  learning_area_id?: string | null;
  staff?:
    | {
        staff_id?: string | null;
        first_name?: string | null;
        last_name?: string | null;
        user_id?: string | null;
      }
    | Array<{
        staff_id?: string | null;
        first_name?: string | null;
        last_name?: string | null;
        user_id?: string | null;
      }>
    | null;
  learning_areas?: { name?: string | null } | Array<{ name?: string | null }> | null;
};

type NormalizedClassAssessment = {
  learningAreaId: string;
  learningAreaName: string;
  score: number;
  date: string;
  assessedBy: string | null;
};

type NormalizedSchoolAssessment = {
  classId: string;
  className: string;
  learningAreaId: string;
  learningAreaName: string;
  score: number;
  date: string;
};

function toNumber(value: unknown): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function getSchoolId(user: AuthUser): string {
  if (!user.schoolId) {
    throw new Error("School context is required.");
  }

  return user.schoolId;
}

function firstRelation<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return value ?? null;
}

function buildName(firstName?: string | null, lastName?: string | null): string {
  return [firstName, lastName].filter(Boolean).join(" ").trim();
}

function getDateFloorIso(lookbackDays: number): string {
  const date = new Date();
  date.setDate(date.getDate() - lookbackDays);
  return date.toISOString().slice(0, 10);
}

function getTrendDirection(delta: number): TrendDirection {
  if (delta > 0.2) {
    return "improving";
  }

  if (delta < -0.2) {
    return "declining";
  }

  return "stable";
}

function average(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }

  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function splitTrendScores(
  rows: Array<{ date: string; score: number }>,
): { currentAverage: number; previousAverage: number; trendDelta: number } {
  if (rows.length === 0) {
    return {
      currentAverage: 0,
      previousAverage: 0,
      trendDelta: 0,
    };
  }

  const sorted = [...rows].sort(
    (left, right) => new Date(left.date).getTime() - new Date(right.date).getTime(),
  );

  if (sorted.length === 1) {
    return {
      currentAverage: round2(sorted[0].score),
      previousAverage: round2(sorted[0].score),
      trendDelta: 0,
    };
  }

  const splitIndex = Math.ceil(sorted.length / 2);
  const firstHalf = sorted.slice(0, splitIndex);
  const secondHalf = sorted.slice(splitIndex);

  const previousAverage = round2(average(firstHalf.map((row) => row.score)));
  const currentAverage = round2(
    average((secondHalf.length > 0 ? secondHalf : firstHalf).map((row) => row.score)),
  );

  return {
    currentAverage,
    previousAverage,
    trendDelta: round2(currentAverage - previousAverage),
  };
}

async function resolveAcademicContext(
  schoolId: string,
  input: {
    termId?: string;
    academicYearId?: string;
  },
): Promise<AcademicContext> {
  const supabase = await createSupabaseServerClient();

  let termId = input.termId ?? null;
  let academicYearId = input.academicYearId ?? null;

  if (termId) {
    const { data: term } = await supabase
      .from("terms")
      .select("term_id, academic_year_id")
      .eq("school_id", schoolId)
      .eq("term_id", termId)
      .maybeSingle();

    if (!term) {
      throw new Error("Selected term was not found in this school.");
    }

    academicYearId = term.academic_year_id;
  }

  if (!termId) {
    const { data: activeTerm } = await supabase
      .from("terms")
      .select("term_id, academic_year_id")
      .eq("school_id", schoolId)
      .eq("is_active", true)
      .order("start_date", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (activeTerm) {
      termId = activeTerm.term_id;
      academicYearId = activeTerm.academic_year_id;
    }
  }

  if (!academicYearId) {
    const { data: activeYear } = await supabase
      .from("academic_years")
      .select("academic_year_id")
      .eq("school_id", schoolId)
      .eq("is_active", true)
      .maybeSingle();

    academicYearId = activeYear?.academic_year_id ?? null;
  }

  return {
    termId,
    academicYearId,
  };
}

function summarizeDropoutRisk(students: DropoutRiskStudent[]): string {
  const high = students.filter((student) => student.riskLevel === "high").length;
  const medium = students.filter((student) => student.riskLevel === "medium").length;

  if (students.length === 0) {
    return "No active students found in this class for risk analysis.";
  }

  if (high === 0 && medium === 0) {
    return "Current class signals are stable with no immediate high-risk learners detected.";
  }

  return `${high} learner(s) are high risk and ${medium} learner(s) are medium risk based on attendance, score trend, and discipline frequency.`;
}

function buildDeterministicRisk(signal: {
  attendanceRate: number;
  currentAverage: number;
  trendDelta: number;
  disciplineCount: number;
  majorIncidents: number;
}): {
  riskScore: number;
  riskLevel: "low" | "medium" | "high";
  reason: string[];
  recommendation: string[];
} {
  let riskScore = 0;
  const reason: string[] = [];
  const recommendation: string[] = [];

  if (signal.attendanceRate < 70) {
    riskScore += 45;
    reason.push(`Low attendance (${signal.attendanceRate.toFixed(1)}%).`);
    recommendation.push("Initiate parent follow-up for attendance recovery.");
  } else if (signal.attendanceRate < 80) {
    riskScore += 30;
    reason.push(`Attendance is below target (${signal.attendanceRate.toFixed(1)}%).`);
    recommendation.push("Set weekly attendance check-ins with class teacher.");
  } else if (signal.attendanceRate < 90) {
    riskScore += 15;
    reason.push(`Attendance is inconsistent (${signal.attendanceRate.toFixed(1)}%).`);
  }

  if (signal.currentAverage < 2) {
    riskScore += 25;
    reason.push(`Low academic average (${signal.currentAverage.toFixed(2)} on CBC scale).`);
    recommendation.push("Provide targeted remedial sessions for weak strands.");
  } else if (signal.currentAverage < 2.5) {
    riskScore += 15;
    reason.push(
      `Academic performance is approaching-risk (${signal.currentAverage.toFixed(2)} on CBC scale).`,
    );
  }

  if (signal.trendDelta < -0.4) {
    riskScore += 20;
    reason.push(`Academic trend is sharply declining (${signal.trendDelta.toFixed(2)}).`);
    recommendation.push("Schedule immediate learner support plan with subject teacher.");
  } else if (signal.trendDelta < -0.2) {
    riskScore += 12;
    reason.push(`Academic trend is declining (${signal.trendDelta.toFixed(2)}).`);
  }

  if (signal.disciplineCount >= 4) {
    riskScore += 20;
    reason.push(`${signal.disciplineCount} discipline incidents in lookback period.`);
    recommendation.push("Assign structured behavior support and mentorship.");
  } else if (signal.disciplineCount >= 2) {
    riskScore += 10;
    reason.push(`${signal.disciplineCount} discipline incidents in lookback period.`);
  }

  if (signal.majorIncidents > 0) {
    riskScore += 10;
    reason.push(`${signal.majorIncidents} major/critical discipline incident(s).`);
    recommendation.push("Escalate to student welfare and counseling team.");
  }

  const riskLevel: "low" | "medium" | "high" =
    riskScore >= 60 ? "high" : riskScore >= 35 ? "medium" : "low";

  if (recommendation.length === 0) {
    recommendation.push(
      riskLevel === "low"
        ? "Maintain current support and continue routine monitoring."
        : "Track this learner weekly and reinforce class support routines.",
    );
  }

  if (reason.length === 0) {
    reason.push("No major risk signal exceeded thresholds in the selected period.");
  }

  return {
    riskScore,
    riskLevel,
    reason: Array.from(new Set(reason)).slice(0, 5),
    recommendation: Array.from(new Set(recommendation)).slice(0, 5),
  };
}

function buildTimeline(rows: Array<{ date: string; score: number }>, lookbackDays: number) {
  if (rows.length === 0) {
    return [] as Array<{ periodLabel: string; averageScore: number; sampleSize: number }>;
  }

  const bucketDays = lookbackDays > 120 ? 30 : lookbackDays > 60 ? 14 : 7;
  const bucketMap = new Map<string, number[]>();

  rows.forEach((row) => {
    const date = new Date(row.date);
    const time = date.getTime();
    const bucketKey = Math.floor(time / (bucketDays * 24 * 60 * 60 * 1000));
    const labelDate = new Date(bucketKey * bucketDays * 24 * 60 * 60 * 1000);
    const label = labelDate.toISOString().slice(0, 10);

    if (!bucketMap.has(label)) {
      bucketMap.set(label, []);
    }

    bucketMap.get(label)!.push(row.score);
  });

  return Array.from(bucketMap.entries())
    .sort((left, right) => left[0].localeCompare(right[0]))
    .map(([periodLabel, scores]) => ({
      periodLabel,
      averageScore: round2(average(scores)),
      sampleSize: scores.length,
    }));
}

export async function generateDropoutRiskDetection(
  input: DropoutRiskRequestInput,
  user: AuthUser,
): Promise<AnalyticsAIResult<DropoutRiskResult>> {
  const schoolId = getSchoolId(user);
  const context = await resolveAcademicContext(schoolId, {
    termId: input.termId,
    academicYearId: input.academicYearId,
  });

  const supabase = await createSupabaseServerClient();
  const lookbackStartIso = getDateFloorIso(input.lookbackDays);

  const { data: classData } = await supabase
    .from("classes")
    .select("class_id, name")
    .eq("school_id", schoolId)
    .eq("class_id", input.classId)
    .maybeSingle<RawClassRow>();

  if (!classData?.class_id) {
    throw new Error("Class not found in this school.");
  }

  const { data: students, error: studentsError } = await supabase
    .from("students")
    .select("student_id, first_name, last_name")
    .eq("school_id", schoolId)
    .eq("current_class_id", input.classId)
    .eq("status", "active")
    .order("first_name", { ascending: true });

  if (studentsError) {
    throw new Error(`Failed to load class students: ${studentsError.message}`);
  }

  const roster = (students ?? [])
    .map((row) => ({
      studentId: (row as RawStudentRow).student_id ?? "",
      name: buildName((row as RawStudentRow).first_name, (row as RawStudentRow).last_name),
    }))
    .filter((row) => row.studentId.length > 0);

  if (roster.length === 0) {
    return {
      result: {
        classId: input.classId,
        className: classData.name ?? "Class",
        lookbackDays: input.lookbackDays,
        evaluatedStudents: 0,
        highRiskCount: 0,
        mediumRiskCount: 0,
        lowRiskCount: 0,
        summary: "No active students found in this class for risk analysis.",
        students: [],
      },
      confidence: 0.9,
      warnings: ["No active students found for selected class."],
      generatedAt: new Date().toISOString(),
    };
  }

  const studentIds = roster.map((student) => student.studentId);

  let assessmentsQuery: any = supabase
    .from("assessments")
    .select("student_id, score, assessment_date")
    .eq("school_id", schoolId)
    .eq("class_id", input.classId)
    .in("student_id", studentIds)
    .gte("assessment_date", lookbackStartIso);

  if (context.termId) {
    assessmentsQuery = assessmentsQuery.eq("term_id", context.termId);
  }
  if (context.academicYearId) {
    assessmentsQuery = assessmentsQuery.eq("academic_year_id", context.academicYearId);
  }

  let attendanceQuery: any = supabase
    .from("attendance")
    .select("student_id, status")
    .eq("school_id", schoolId)
    .eq("class_id", input.classId)
    .in("student_id", studentIds)
    .gte("date", lookbackStartIso);

  if (context.termId) {
    attendanceQuery = attendanceQuery.eq("term_id", context.termId);
  }

  const disciplineQuery = supabase
    .from("disciplinary_records")
    .select("student_id, severity")
    .eq("school_id", schoolId)
    .in("student_id", studentIds)
    .gte("incident_date", lookbackStartIso);

  const [assessmentsResult, attendanceResult, disciplineResult] = await Promise.all([
    assessmentsQuery,
    attendanceQuery,
    disciplineQuery,
  ]);

  if (assessmentsResult.error) {
    throw new Error(`Failed to load assessments: ${assessmentsResult.error.message}`);
  }

  if (attendanceResult.error) {
    throw new Error(`Failed to load attendance: ${attendanceResult.error.message}`);
  }

  if (disciplineResult.error) {
    throw new Error(`Failed to load discipline records: ${disciplineResult.error.message}`);
  }

  const scoreMap = new Map<string, Array<{ date: string; score: number }>>();
  (assessmentsResult.data ?? []).forEach((row: RawAssessmentRow) => {
    const studentId = row.student_id;
    if (!studentId || !row.assessment_date) {
      return;
    }

    if (!scoreMap.has(studentId)) {
      scoreMap.set(studentId, []);
    }

    scoreMap.get(studentId)!.push({
      date: row.assessment_date,
      score: toNumber(row.score),
    });
  });

  const attendanceMap = new Map<string, { total: number; presentLike: number }>();
  (attendanceResult.data ?? []).forEach((row: RawAttendanceRow) => {
    const studentId = row.student_id;
    if (!studentId) {
      return;
    }

    if (!attendanceMap.has(studentId)) {
      attendanceMap.set(studentId, { total: 0, presentLike: 0 });
    }

    const entry = attendanceMap.get(studentId)!;
    entry.total += 1;

    if (row.status === "present" || row.status === "late") {
      entry.presentLike += 1;
    }
  });

  const disciplineMap = new Map<string, { total: number; major: number }>();
  (disciplineResult.data ?? []).forEach((row: RawDisciplineRow) => {
    const studentId = row.student_id;
    if (!studentId) {
      return;
    }

    if (!disciplineMap.has(studentId)) {
      disciplineMap.set(studentId, { total: 0, major: 0 });
    }

    const entry = disciplineMap.get(studentId)!;
    entry.total += 1;

    if (row.severity === "major" || row.severity === "critical") {
      entry.major += 1;
    }
  });

  const evaluated = roster
    .map((student) => {
      const scores = scoreMap.get(student.studentId) ?? [];
      const attendance = attendanceMap.get(student.studentId) ?? {
        total: 0,
        presentLike: 0,
      };
      const discipline = disciplineMap.get(student.studentId) ?? { total: 0, major: 0 };

      const trend = splitTrendScores(scores);
      const attendanceRate =
        attendance.total > 0 ? round2((attendance.presentLike / attendance.total) * 100) : 0;

      const deterministic = buildDeterministicRisk({
        attendanceRate,
        currentAverage: trend.currentAverage,
        trendDelta: trend.trendDelta,
        disciplineCount: discipline.total,
        majorIncidents: discipline.major,
      });

      return {
        riskScore: deterministic.riskScore,
        row: {
          studentId: student.studentId,
          name: student.name,
          attendanceRate,
          averageScore: trend.currentAverage,
          previousAverageScore: trend.previousAverage,
          trendDelta: trend.trendDelta,
          disciplineCount: discipline.total,
          majorIncidents: discipline.major,
          riskLevel: deterministic.riskLevel,
          reason: deterministic.reason,
          recommendation: deterministic.recommendation,
        } satisfies DropoutRiskStudent,
      };
    })
    .sort((left, right) => right.riskScore - left.riskScore)
    .slice(0, input.maxStudents);

  let studentsResult = evaluated.map((entry) => entry.row);
  let summary = summarizeDropoutRisk(studentsResult);
  let confidence = 0.84;
  const warnings: string[] = [];

  const aiCandidates = studentsResult
    .filter((student) => student.riskLevel !== "low")
    .slice(0, 12);

  if (aiCandidates.length > 0) {
    try {
      const ai = await generateGroqCompletion<z.infer<typeof dropoutRiskAiSchema>>({
        system:
          "You are an education risk analyst for Kenyan CBC schools. Use ONLY provided metrics and baseline outputs. Return JSON only.",
        prompt: [
          "Output schema:",
          JSON.stringify({
            summary: "string",
            students: [
              {
                studentId: "uuid",
                riskLevel: "low | medium | high",
                reason: ["string"],
                recommendation: ["string"],
              },
            ],
          }),
          "",
          "Rules:",
          "1. Do not invent students or data points.",
          "2. Keep reasons tied to attendance, performance trend, and discipline metrics.",
          "3. recommendation must be practical school interventions.",
          "4. Keep each reason/recommendation concise.",
          "",
          `Class: ${classData.name ?? "Class"}`,
          `Lookback days: ${input.lookbackDays}`,
          `Candidate data: ${JSON.stringify(aiCandidates)}`,
          `Baseline summary: ${summary}`,
        ].join("\n"),
        responseFormat: "json",
        temperature: 0.15,
        responseSchema: dropoutRiskAiSchema,
        requestLabel: "analytics-ai.dropout-risk",
        cache: {
          schoolId,
          classId: input.classId,
          subject: "dropout-risk",
        },
      });

      const parsed = dropoutRiskAiSchema.parse(ai.data);
      const aiById = new Map(parsed.students.map((item) => [item.studentId, item]));

      studentsResult = studentsResult.map((student) => {
        const aiStudent = aiById.get(student.studentId);
        if (!aiStudent) {
          return student;
        }

        return {
          ...student,
          riskLevel: aiStudent.riskLevel,
          reason: aiStudent.reason,
          recommendation: aiStudent.recommendation,
        };
      });

      summary = parsed.summary;
      confidence = ai.confidence;
      warnings.push(...(ai.warnings ?? []));
    } catch (error) {
      warnings.push(
        "AI refinement fallback used for dropout risk.",
        error instanceof Error ? error.message : "Unknown AI fallback reason.",
      );
    }
  } else {
    warnings.push("No medium/high risk learners detected for AI refinement.");
  }

  const highRiskCount = studentsResult.filter((student) => student.riskLevel === "high").length;
  const mediumRiskCount = studentsResult.filter(
    (student) => student.riskLevel === "medium",
  ).length;

  return {
    result: {
      classId: input.classId,
      className: classData.name ?? "Class",
      lookbackDays: input.lookbackDays,
      evaluatedStudents: studentsResult.length,
      highRiskCount,
      mediumRiskCount,
      lowRiskCount: studentsResult.length - highRiskCount - mediumRiskCount,
      summary,
      students: studentsResult,
    },
    confidence,
    warnings,
    generatedAt: new Date().toISOString(),
  };
}

function fallbackClassInsights(args: {
  className: string;
  subjectTrends: ClassPerformanceResult["subjectTrends"];
}): ClassPerformanceResult["insights"] {
  const weakest = [...args.subjectTrends].sort((left, right) => left.averageScore - right.averageScore)[0];
  const strongest = [...args.subjectTrends].sort((left, right) => right.averageScore - left.averageScore)[0];

  const highlights = [
    strongest
      ? `Strongest learning area is ${strongest.learningAreaName} (${strongest.averageScore.toFixed(2)}).`
      : "No strong learning area signal available.",
    weakest
      ? `Lowest learning area is ${weakest.learningAreaName} (${weakest.averageScore.toFixed(2)}).`
      : "No weak learning area signal available.",
  ];

  return {
    summary: `Performance trend summary generated for ${args.className} from aggregated assessment data.`,
    highlights,
    recommendations: [
      "Review declining learning areas in weekly departmental meetings.",
      "Assign targeted remediation for learners below CBC level 2.",
    ],
  };
}

export async function generateClassPerformanceTrends(
  input: ClassPerformanceRequestInput,
  user: AuthUser,
): Promise<AnalyticsAIResult<ClassPerformanceResult>> {
  const schoolId = getSchoolId(user);
  const context = await resolveAcademicContext(schoolId, {
    termId: input.termId,
    academicYearId: input.academicYearId,
  });

  const supabase = await createSupabaseServerClient();
  const lookbackStartIso = getDateFloorIso(input.lookbackDays);

  const { data: classData } = await supabase
    .from("classes")
    .select("class_id, name")
    .eq("school_id", schoolId)
    .eq("class_id", input.classId)
    .maybeSingle<RawClassRow>();

  if (!classData?.class_id) {
    throw new Error("Class not found in this school.");
  }

  let assessmentsQuery: any = supabase
    .from("assessments")
    .select("learning_area_id, score, assessment_date, assessed_by, learning_areas(name)")
    .eq("school_id", schoolId)
    .eq("class_id", input.classId)
    .gte("assessment_date", lookbackStartIso);

  if (input.learningAreaId) {
    assessmentsQuery = assessmentsQuery.eq("learning_area_id", input.learningAreaId);
  }
  if (context.termId) {
    assessmentsQuery = assessmentsQuery.eq("term_id", context.termId);
  }
  if (context.academicYearId) {
    assessmentsQuery = assessmentsQuery.eq("academic_year_id", context.academicYearId);
  }

  const { data: assessmentsRaw, error: assessmentsError } = await assessmentsQuery;

  if (assessmentsError) {
    throw new Error(`Failed to load class assessments: ${assessmentsError.message}`);
  }

  const assessments: NormalizedClassAssessment[] = (assessmentsRaw ?? [])
    .map((row: RawAssessmentRow) => {
      const learningArea = firstRelation(row.learning_areas);
      if (!row.learning_area_id || !row.assessment_date) {
        return null;
      }

      return {
        learningAreaId: row.learning_area_id,
        learningAreaName: learningArea?.name ?? "Learning Area",
        score: toNumber(row.score),
        date: row.assessment_date,
        assessedBy: row.assessed_by ?? null,
      };
    })
    .filter((row: NormalizedClassAssessment | null): row is NormalizedClassAssessment => row !== null);

  if (assessments.length === 0) {
    return {
      result: {
        classId: input.classId,
        className: classData.name ?? "Class",
        lookbackDays: input.lookbackDays,
        overallAverageScore: 0,
        timeline: [],
        subjectTrends: [],
        teacherComparison: [],
        insights: {
          summary: "No assessments found for selected filters.",
          highlights: ["Capture assessments to unlock class intelligence trends."],
          recommendations: ["Record at least one assessment cycle for trend analysis."],
        },
      },
      confidence: 0.9,
      warnings: ["No assessment data found for selected filters."],
      generatedAt: new Date().toISOString(),
    };
  }

  const overallAverageScore = round2(average(assessments.map((item) => item.score)));
  const timeline = buildTimeline(
    assessments.map((item) => ({ date: item.date, score: item.score })),
    input.lookbackDays,
  );

  const subjectMap = new Map<string, { name: string; rows: Array<{ date: string; score: number }> }>();
  assessments.forEach((row) => {
    if (!subjectMap.has(row.learningAreaId)) {
      subjectMap.set(row.learningAreaId, {
        name: row.learningAreaName,
        rows: [],
      });
    }

    subjectMap.get(row.learningAreaId)!.rows.push({ date: row.date, score: row.score });
  });

  const subjectTrends = Array.from(subjectMap.entries())
    .map(([learningAreaId, data]) => {
      const trend = splitTrendScores(data.rows);
      const trendDirection = getTrendDirection(trend.trendDelta);

      return {
        learningAreaId,
        learningAreaName: data.name,
        averageScore: trend.currentAverage,
        previousAverageScore: trend.previousAverage,
        trendDelta: trend.trendDelta,
        trendDirection,
        sampleSize: data.rows.length,
      };
    })
    .sort((left, right) => left.learningAreaName.localeCompare(right.learningAreaName));

  let teacherAssignmentsQuery: any = supabase
    .from("teacher_subjects")
    .select(
      "teacher_id, learning_area_id, staff:staff!teacher_subjects_teacher_id_fkey(staff_id, first_name, last_name, user_id), learning_areas(name)",
    )
    .eq("school_id", schoolId)
    .eq("class_id", input.classId)
    .eq("is_active", true);

  if (input.learningAreaId) {
    teacherAssignmentsQuery = teacherAssignmentsQuery.eq("learning_area_id", input.learningAreaId);
  }
  if (context.termId) {
    teacherAssignmentsQuery = teacherAssignmentsQuery.eq("term_id", context.termId);
  }
  if (context.academicYearId) {
    teacherAssignmentsQuery = teacherAssignmentsQuery.eq("academic_year_id", context.academicYearId);
  }

  const { data: teacherAssignmentsRaw } = await teacherAssignmentsQuery;

  const teacherComparison: ClassPerformanceResult["teacherComparison"] = ((teacherAssignmentsRaw ??
    []) as RawTeacherAssignmentRow[])
    .map((assignment) => {
      if (!assignment.teacher_id || !assignment.learning_area_id) {
        return null;
      }

      const staff = firstRelation(assignment.staff);
      const learningArea = firstRelation(assignment.learning_areas);

      const areaRows = assessments.filter(
        (row) => row.learningAreaId === assignment.learning_area_id,
      );
      const directRows = staff?.user_id
        ? areaRows.filter((row) => row.assessedBy === staff.user_id)
        : [];
      const selectedRows = directRows.length >= 3 ? directRows : areaRows;

      if (selectedRows.length === 0) {
        return null;
      }

      const averageScore = round2(average(selectedRows.map((row: NormalizedClassAssessment) => row.score)));

      return {
        teacherId: assignment.teacher_id,
        teacherName: buildName(staff?.first_name, staff?.last_name) || "Teacher",
        learningAreaId: assignment.learning_area_id,
        learningAreaName: learningArea?.name ?? "Learning Area",
        averageScore,
        assessmentCount: selectedRows.length,
        relativeToClassAverage: round2(averageScore - overallAverageScore),
        evidenceMode:
          directRows.length >= 3
            ? ("direct_assessed_by" as const)
            : ("assignment_proxy" as const),
      };
    })
    .filter((row): row is ClassPerformanceResult["teacherComparison"][number] => row !== null)
    .sort((left, right) => right.averageScore - left.averageScore);

  let insights = fallbackClassInsights({
    className: classData.name ?? "Class",
    subjectTrends,
  });
  let confidence = 0.83;
  const warnings: string[] = [];

  try {
    const ai = await generateGroqCompletion<z.infer<typeof classPerformanceAiSchema>>({
      system:
        "You are a class performance analyst for Kenyan CBC schools. Use only supplied aggregates and trend metrics. Return JSON only.",
      prompt: [
        "Output schema:",
        JSON.stringify({
          summary: "string",
          highlights: ["string"],
          recommendations: ["string"],
          teacherInsights: [{ teacherId: "uuid", insight: "string" }],
        }),
        "",
        "Rules:",
        "1. Do not invent data values or teachers.",
        "2. Highlights must reference trend or averages from input.",
        "3. Recommendations must be practical and school-actionable.",
        "",
        `Class: ${classData.name ?? "Class"}`,
        `Lookback days: ${input.lookbackDays}`,
        `Overall average: ${overallAverageScore}`,
        `Subject trends: ${JSON.stringify(subjectTrends)}`,
        `Teacher comparison: ${JSON.stringify(teacherComparison)}`,
      ].join("\n"),
      responseFormat: "json",
      temperature: 0.15,
      responseSchema: classPerformanceAiSchema,
      requestLabel: "analytics-ai.class-performance",
      cache: {
        schoolId,
        classId: input.classId,
        subject: input.learningAreaId ?? "class-performance",
      },
    });

    const parsed = classPerformanceAiSchema.parse(ai.data);
    const teacherInsightMap = new Map(parsed.teacherInsights.map((item) => [item.teacherId, item.insight]));

    insights = {
      summary: parsed.summary,
      highlights: parsed.highlights,
      recommendations: parsed.recommendations,
    };

    teacherComparison.forEach((teacher: ClassPerformanceResult["teacherComparison"][number]) => {
      const insight = teacherInsightMap.get(teacher.teacherId);
      if (insight) {
        teacher.insight = insight;
      }
    });

    confidence = ai.confidence;
    warnings.push(...(ai.warnings ?? []));
  } catch (error) {
    warnings.push(
      "AI refinement fallback used for class performance trends.",
      error instanceof Error ? error.message : "Unknown AI fallback reason.",
    );
  }

  return {
    result: {
      classId: input.classId,
      className: classData.name ?? "Class",
      lookbackDays: input.lookbackDays,
      overallAverageScore,
      timeline,
      subjectTrends,
      teacherComparison,
      insights,
    },
    confidence,
    warnings,
    generatedAt: new Date().toISOString(),
  };
}

function fallbackSchoolHealthSummary(args: {
  weakestSubjectName: string | null;
  decliningCount: number;
  improvingCount: number;
}): {
  summary: string;
  priorityActions: string[];
  watchList: string[];
} {
  const summary = args.weakestSubjectName
    ? `School health analysis shows ${args.weakestSubjectName} as the weakest learning area, with ${args.decliningCount} declining classes and ${args.improvingCount} improving classes.`
    : `School health analysis completed with ${args.decliningCount} declining classes and ${args.improvingCount} improving classes.`;

  const watchList = [
    args.decliningCount > 0
      ? `${args.decliningCount} class(es) show declining performance trend.`
      : "No classes are currently in sharp decline.",
    args.weakestSubjectName
      ? `Weak subject signal: ${args.weakestSubjectName}.`
      : "No weak subject signal reached minimum sample threshold.",
  ];

  return {
    summary,
    priorityActions: [
      "Schedule intervention plans for declining classes with heads of department.",
      "Prioritize teacher support for the lowest-performing learning area.",
    ],
    watchList,
  };
}

export async function generateSchoolHealthDashboard(
  input: SchoolHealthRequestInput,
  user: AuthUser,
): Promise<AnalyticsAIResult<SchoolHealthResult>> {
  const schoolId = getSchoolId(user);
  const context = await resolveAcademicContext(schoolId, {
    termId: input.termId,
    academicYearId: input.academicYearId,
  });

  const supabase = await createSupabaseServerClient();
  const lookbackStartIso = getDateFloorIso(input.lookbackDays);

  let assessmentsQuery: any = supabase
    .from("assessments")
    .select("class_id, learning_area_id, score, assessment_date, learning_areas(name), classes(name)")
    .eq("school_id", schoolId)
    .gte("assessment_date", lookbackStartIso);

  if (context.termId) {
    assessmentsQuery = assessmentsQuery.eq("term_id", context.termId);
  }
  if (context.academicYearId) {
    assessmentsQuery = assessmentsQuery.eq("academic_year_id", context.academicYearId);
  }

  const { data: assessmentsRaw, error: assessmentsError } = await assessmentsQuery;
  if (assessmentsError) {
    throw new Error(`Failed to load school assessments: ${assessmentsError.message}`);
  }

  const assessments: NormalizedSchoolAssessment[] = (assessmentsRaw ?? [])
    .map((row: RawAssessmentRow) => {
      if (!row.class_id || !row.learning_area_id || !row.assessment_date) {
        return null;
      }

      const learningArea = firstRelation(row.learning_areas);
      const classInfo = firstRelation(row.classes);

      return {
        classId: row.class_id,
        className: classInfo?.name ?? "Class",
        learningAreaId: row.learning_area_id,
        learningAreaName: learningArea?.name ?? "Learning Area",
        score: toNumber(row.score),
        date: row.assessment_date,
      };
    })
    .filter((row: NormalizedSchoolAssessment | null): row is NormalizedSchoolAssessment => row !== null);

  if (assessments.length === 0) {
    return {
      result: {
        lookbackDays: input.lookbackDays,
        overallAverageScore: 0,
        weakestSubject: null,
        decliningClasses: [],
        improvingClasses: [],
        summary: "No assessments found for school health analysis.",
        priorityActions: ["Capture more assessment records to enable school-level trend analysis."],
        watchList: ["No assessment data found in selected period."],
      },
      confidence: 0.9,
      warnings: ["No assessment data found for selected filters."],
      generatedAt: new Date().toISOString(),
    };
  }

  const overallAverageScore = round2(average(assessments.map((item) => item.score)));

  const subjectMap = new Map<string, { name: string; scores: number[] }>();
  assessments.forEach((item) => {
    if (!subjectMap.has(item.learningAreaId)) {
      subjectMap.set(item.learningAreaId, {
        name: item.learningAreaName,
        scores: [],
      });
    }

    subjectMap.get(item.learningAreaId)!.scores.push(item.score);
  });

  const subjectRows = Array.from(subjectMap.entries()).map(([learningAreaId, data]) => ({
    learningAreaId,
    learningAreaName: data.name,
    averageScore: round2(average(data.scores)),
    sampleSize: data.scores.length,
  }));

  const weakestSubject =
    [...subjectRows]
      .filter((row) => row.sampleSize >= input.minAssessments)
      .sort((left, right) => left.averageScore - right.averageScore)[0] ??
    [...subjectRows].sort((left, right) => left.averageScore - right.averageScore)[0] ??
    null;

  const classMap = new Map<
    string,
    {
      className: string;
      rows: Array<{ date: string; score: number }>;
    }
  >();

  assessments.forEach((item) => {
    if (!classMap.has(item.classId)) {
      classMap.set(item.classId, {
        className: item.className,
        rows: [],
      });
    }

    classMap.get(item.classId)!.rows.push({
      date: item.date,
      score: item.score,
    });
  });

  let attendanceQuery: any = supabase
    .from("attendance")
    .select("class_id, status")
    .eq("school_id", schoolId)
    .gte("date", lookbackStartIso);

  if (context.termId) {
    attendanceQuery = attendanceQuery.eq("term_id", context.termId);
  }

  const { data: attendanceRows } = await attendanceQuery;

  const attendanceMap = new Map<string, { total: number; presentLike: number }>();
  (attendanceRows ?? []).forEach((row: RawAttendanceRow) => {
    if (!row.class_id) {
      return;
    }

    if (!attendanceMap.has(row.class_id)) {
      attendanceMap.set(row.class_id, { total: 0, presentLike: 0 });
    }

    const entry = attendanceMap.get(row.class_id)!;
    entry.total += 1;
    if (row.status === "present" || row.status === "late") {
      entry.presentLike += 1;
    }
  });

  const classTrends: SchoolHealthClassTrend[] = Array.from(classMap.entries())
    .map(([classId, data]) => {
      const trend = splitTrendScores(data.rows);
      const attendance = attendanceMap.get(classId);
      const attendanceRate = attendance
        ? round2((attendance.presentLike / Math.max(1, attendance.total)) * 100)
        : null;

      return {
        classId,
        className: data.className,
        averageScore: trend.currentAverage,
        previousAverageScore: trend.previousAverage,
        trendDelta: trend.trendDelta,
        trendDirection: getTrendDirection(trend.trendDelta),
        sampleSize: data.rows.length,
        attendanceRate,
      };
    })
    .filter((item) => item.sampleSize >= input.minAssessments)
    .sort((left, right) => left.className.localeCompare(right.className));

  const decliningClasses = classTrends
    .filter((item) => item.trendDirection === "declining")
    .sort((left, right) => left.trendDelta - right.trendDelta)
    .slice(0, 8);

  const improvingClasses = classTrends
    .filter((item) => item.trendDirection === "improving")
    .sort((left, right) => right.trendDelta - left.trendDelta)
    .slice(0, 8);

  let summaryPayload = fallbackSchoolHealthSummary({
    weakestSubjectName: weakestSubject?.learningAreaName ?? null,
    decliningCount: decliningClasses.length,
    improvingCount: improvingClasses.length,
  });

  let confidence = 0.85;
  const warnings: string[] = [];

  try {
    const ai = await generateGroqCompletion<z.infer<typeof schoolHealthAiSchema>>({
      system:
        "You are a school performance strategist for CBC schools. Use only provided metrics and return JSON only.",
      prompt: [
        "Output schema:",
        JSON.stringify({
          schoolSummary: "string",
          priorityActions: ["string"],
          watchList: ["string"],
        }),
        "",
        "Rules:",
        "1. No invented metrics or classes.",
        "2. Keep actions practical for school leadership teams.",
        "3. Focus on weakest subject and class movement trends.",
        "",
        `Lookback days: ${input.lookbackDays}`,
        `Overall average score: ${overallAverageScore}`,
        `Weakest subject: ${JSON.stringify(weakestSubject)}`,
        `Declining classes: ${JSON.stringify(decliningClasses)}`,
        `Improving classes: ${JSON.stringify(improvingClasses)}`,
      ].join("\n"),
      responseFormat: "json",
      temperature: 0.15,
      responseSchema: schoolHealthAiSchema,
      requestLabel: "analytics-ai.school-health",
      cache: {
        schoolId,
        subject: "school-health",
      },
    });

    const parsed = schoolHealthAiSchema.parse(ai.data);
    summaryPayload = {
      summary: parsed.schoolSummary,
      priorityActions: parsed.priorityActions,
      watchList: parsed.watchList,
    };

    confidence = ai.confidence;
    warnings.push(...(ai.warnings ?? []));
  } catch (error) {
    warnings.push(
      "AI refinement fallback used for school health dashboard.",
      error instanceof Error ? error.message : "Unknown AI fallback reason.",
    );
  }

  return {
    result: {
      lookbackDays: input.lookbackDays,
      overallAverageScore,
      weakestSubject,
      decliningClasses,
      improvingClasses,
      summary: summaryPayload.summary,
      priorityActions: summaryPayload.priorityActions,
      watchList: summaryPayload.watchList,
    },
    confidence,
    warnings,
    generatedAt: new Date().toISOString(),
  };
}
