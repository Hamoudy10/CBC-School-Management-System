import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { generateGroqCompletion } from "@/lib/ai/groq.client";
import type { AuthUser } from "@/types/auth";
import type {
  ClassroomInsightsRequestInput,
  MarkEntryAssistantRequestInput,
  ReportCommentRequestInput,
} from "../validators/teacherAi.schema";
import type {
  ClassroomInsightsResult,
  MarkEntrySuggestionResult,
  ReportCommentResult,
  TeacherAICopilotResult,
  TeacherAIStudentOption,
} from "../types";

const reportCommentSchema = z.object({
  comment: z.string().min(1),
  performanceSummary: z.string().min(1),
  behaviorSummary: z.string().min(1),
  nextSteps: z.array(z.string().min(1)).min(2).max(6),
});

const markEntrySchema = z.object({
  grade: z.enum(["A", "B", "C", "D", "E"]),
  performanceLevel: z.enum([
    "exceeding_expectation",
    "meeting_expectation",
    "approaching_expectation",
    "below_expectation",
  ]),
  scoreOnCbcScale: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]),
  comment: z.string().min(1),
  rationale: z.string().min(1),
});

const classroomInsightsSchema = z.object({
  weakStudents: z.array(
    z.object({
      studentId: z.string().uuid(),
      name: z.string().min(1),
      reasons: z.array(z.string().min(1)).min(1).max(4),
    }),
  ),
  strongPerformers: z.array(
    z.object({
      studentId: z.string().uuid(),
      name: z.string().min(1),
      reasons: z.array(z.string().min(1)).min(1).max(4),
    }),
  ),
  attentionNeeded: z.array(
    z.object({
      studentId: z.string().uuid(),
      name: z.string().min(1),
      reasons: z.array(z.string().min(1)).min(1).max(4),
    }),
  ),
  classSummary: z.string().min(1),
});

type AcademicContext = {
  termId: string | null;
  academicYearId: string | null;
  termStartDate: string | null;
  termEndDate: string | null;
};

type StudentSignal = {
  studentId: string;
  name: string;
  averageScore: number;
  assessmentCount: number;
  attendanceRate: number;
  attendanceRecords: number;
  disciplineCount: number;
  majorIncidents: number;
};

function getSchoolId(user: AuthUser): string {
  if (!user.schoolId) {
    throw new Error("School context is required.");
  }

  return user.schoolId;
}

async function resolveAcademicContext(
  schoolId: string,
  input: {
    termId?: string;
    academicYearId?: string;
  },
): Promise<AcademicContext> {
  const supabase = await createSupabaseServerClient();
  let academicYearId = input.academicYearId ?? null;
  let termId = input.termId ?? null;
  let termStartDate: string | null = null;
  let termEndDate: string | null = null;

  if (termId) {
    const { data: term } = await supabase
      .from("terms")
      .select("term_id, academic_year_id, start_date, end_date")
      .eq("school_id", schoolId)
      .eq("term_id", termId)
      .maybeSingle();

    if (!term) {
      throw new Error("Selected term not found in this school.");
    }

    academicYearId = term.academic_year_id;
    termStartDate = term.start_date ?? null;
    termEndDate = term.end_date ?? null;
  } else {
    const { data: activeTerm } = await supabase
      .from("terms")
      .select("term_id, academic_year_id, start_date, end_date")
      .eq("school_id", schoolId)
      .eq("is_active", true)
      .order("start_date", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (activeTerm) {
      termId = activeTerm.term_id;
      academicYearId = activeTerm.academic_year_id;
      termStartDate = activeTerm.start_date ?? null;
      termEndDate = activeTerm.end_date ?? null;
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
    termStartDate,
    termEndDate,
  };
}

function deterministicMarkSuggestion(rawMark: number, maxMark: number): MarkEntrySuggestionResult {
  const percentage = Math.max(0, Math.min(100, (rawMark / Math.max(1, maxMark)) * 100));

  const grade: MarkEntrySuggestionResult["grade"] =
    percentage >= 80 ? "A" : percentage >= 65 ? "B" : percentage >= 50 ? "C" : percentage >= 35 ? "D" : "E";

  const scoreOnCbcScale: MarkEntrySuggestionResult["scoreOnCbcScale"] =
    percentage >= 75 ? 4 : percentage >= 50 ? 3 : percentage >= 35 ? 2 : 1;

  const performanceLevel: MarkEntrySuggestionResult["performanceLevel"] =
    scoreOnCbcScale === 4
      ? "exceeding_expectation"
      : scoreOnCbcScale === 3
        ? "meeting_expectation"
        : scoreOnCbcScale === 2
          ? "approaching_expectation"
          : "below_expectation";

  return {
    grade,
    performanceLevel,
    scoreOnCbcScale,
    comment:
      performanceLevel === "exceeding_expectation"
        ? "Excellent performance with strong competency demonstration."
        : performanceLevel === "meeting_expectation"
          ? "Solid progress and good understanding of key concepts."
          : performanceLevel === "approaching_expectation"
            ? "Shows developing understanding; targeted support will help growth."
            : "Needs focused intervention and more guided practice.",
    rationale: `Mapped from ${percentage.toFixed(1)}% using school mark-to-grade and CBC level thresholds.`,
  };
}

function buildStudentName(student: { first_name?: string | null; last_name?: string | null }) {
  return [student.first_name, student.last_name].filter(Boolean).join(" ").trim();
}

export async function listClassStudentsForTeacherAI(
  classId: string,
  user: AuthUser,
): Promise<TeacherAIStudentOption[]> {
  const schoolId = getSchoolId(user);
  const supabase = await createSupabaseServerClient();

  const { data: classExists } = await supabase
    .from("classes")
    .select("class_id")
    .eq("school_id", schoolId)
    .eq("class_id", classId)
    .maybeSingle();

  if (!classExists) {
    throw new Error("Class not found in this school.");
  }

  const { data, error } = await supabase
    .from("students")
    .select("student_id, first_name, last_name, admission_number")
    .eq("school_id", schoolId)
    .eq("current_class_id", classId)
    .eq("status", "active")
    .order("first_name", { ascending: true });

  if (error) {
    throw new Error(`Failed to load class students: ${error.message}`);
  }

  return (data ?? []).map((row: any) => ({
    studentId: row.student_id,
    fullName: buildStudentName(row),
    admissionNumber: row.admission_number ?? "",
  }));
}

export async function generateTeacherReportComment(
  input: ReportCommentRequestInput,
  user: AuthUser,
): Promise<TeacherAICopilotResult<ReportCommentResult>> {
  const schoolId = getSchoolId(user);
  const supabase = await createSupabaseServerClient();
  const academicContext = await resolveAcademicContext(schoolId, {
    termId: input.termId,
    academicYearId: input.academicYearId,
  });

  const { data: student } = await supabase
    .from("students")
    .select("student_id, first_name, last_name, admission_number, current_class_id")
    .eq("school_id", schoolId)
    .eq("student_id", input.studentId)
    .eq("status", "active")
    .maybeSingle();

  if (!student) {
    throw new Error("Student not found in this school.");
  }

  if (student.current_class_id !== input.classId) {
    throw new Error("Selected student does not belong to the selected class.");
  }

  let assessmentsQuery = supabase
    .from("assessments")
    .select("score, remarks, assessment_date, learning_area_id, learning_areas(name)")
    .eq("school_id", schoolId)
    .eq("student_id", input.studentId)
    .eq("class_id", input.classId)
    .order("assessment_date", { ascending: false });

  if (academicContext.termId) {
    assessmentsQuery = assessmentsQuery.eq("term_id", academicContext.termId);
  }
  if (academicContext.academicYearId) {
    assessmentsQuery = assessmentsQuery.eq("academic_year_id", academicContext.academicYearId);
  }
  if (input.learningAreaId) {
    assessmentsQuery = assessmentsQuery.eq("learning_area_id", input.learningAreaId);
  }

  const { data: assessments, error: assessmentsError } = await assessmentsQuery;
  if (assessmentsError) {
    throw new Error(`Failed to load student assessments: ${assessmentsError.message}`);
  }

  let attendanceQuery = supabase
    .from("attendance")
    .select("status, date")
    .eq("school_id", schoolId)
    .eq("student_id", input.studentId)
    .eq("class_id", input.classId);

  if (academicContext.termId) {
    attendanceQuery = attendanceQuery.eq("term_id", academicContext.termId);
  }

  const { data: attendanceRows, error: attendanceError } = await attendanceQuery;
  if (attendanceError) {
    throw new Error(`Failed to load student attendance: ${attendanceError.message}`);
  }

  let disciplineQuery = supabase
    .from("disciplinary_records")
    .select("severity, status, incident_type, incident_date, action_taken")
    .eq("school_id", schoolId)
    .eq("student_id", input.studentId)
    .order("incident_date", { ascending: false });

  if (academicContext.termStartDate) {
    disciplineQuery = disciplineQuery.gte("incident_date", academicContext.termStartDate);
  }
  if (academicContext.termEndDate) {
    disciplineQuery = disciplineQuery.lte("incident_date", academicContext.termEndDate);
  }

  const { data: disciplineRows, error: disciplineError } = await disciplineQuery;
  if (disciplineError) {
    throw new Error(`Failed to load discipline records: ${disciplineError.message}`);
  }

  const assessmentScores = (assessments ?? [])
    .map((row: any) => Number(row.score))
    .filter((value: number) => Number.isFinite(value));
  const averageScore =
    assessmentScores.length > 0
      ? Number(
          (
            assessmentScores.reduce((sum: number, value: number) => sum + value, 0) /
            assessmentScores.length
          ).toFixed(2),
        )
      : null;

  const attendanceTotal = (attendanceRows ?? []).length;
  const presentLike = (attendanceRows ?? []).filter(
    (row: any) => row.status === "present" || row.status === "late",
  ).length;
  const attendanceRate =
    attendanceTotal > 0 ? Number(((presentLike / attendanceTotal) * 100).toFixed(1)) : null;

  const disciplineCount = (disciplineRows ?? []).length;
  const majorDisciplineCount = (disciplineRows ?? []).filter(
    (row: any) => row.severity === "major" || row.severity === "critical",
  ).length;

  const payload = {
    student: {
      studentId: student.student_id,
      name: buildStudentName(student),
      admissionNumber: student.admission_number,
    },
    classId: input.classId,
    learningAreaId: input.learningAreaId ?? null,
    termId: academicContext.termId,
    academicYearId: academicContext.academicYearId,
    metrics: {
      averageScoreOnCbcScale: averageScore,
      assessmentCount: assessmentScores.length,
      attendanceRate,
      attendanceRecords: attendanceTotal,
      disciplineCount,
      majorDisciplineCount,
    },
    assessmentEvidence: (assessments ?? []).slice(0, 12).map((row: any) => ({
      score: row.score,
      remarks: row.remarks ?? null,
      date: row.assessment_date,
      learningAreaName: (Array.isArray(row.learning_areas) ? row.learning_areas[0] : row.learning_areas)
        ?.name ?? null,
    })),
    behaviorEvidence: (disciplineRows ?? []).slice(0, 8).map((row: any) => ({
      severity: row.severity,
      status: row.status,
      incidentType: row.incident_type,
      actionTaken: row.action_taken ?? null,
      incidentDate: row.incident_date,
    })),
  };

  const ai = await generateGroqCompletion<ReportCommentResult>({
    system:
      "You are a Kenyan CBC teacher assistant generating concise report comments from assessment, attendance, and behavior data. Return JSON only.",
    prompt: [
      "Generate report comments using this strict JSON schema:",
      JSON.stringify({
        comment: "string",
        performanceSummary: "string",
        behaviorSummary: "string",
        nextSteps: ["string"],
      }),
      "",
      "Rules:",
      "1. Keep language professional and constructive.",
      "2. Use evidence from marks, attendance, and discipline.",
      "3. Mention both strengths and growth needs.",
      "4. nextSteps must have practical actions.",
      "",
      `Input data: ${JSON.stringify(payload)}`,
    ].join("\n"),
    responseFormat: "json",
    temperature: 0.2,
    responseSchema: reportCommentSchema,
    requestLabel: "teacher-ai.report-comment",
    cache: {
      schoolId,
      classId: input.classId,
      subject: input.learningAreaId ?? "general-report-comment",
    },
  });

  return {
    result: reportCommentSchema.parse(ai.data),
    confidence: ai.confidence,
    warnings: ai.warnings ?? [],
    generatedAt: new Date().toISOString(),
  };
}

export async function generateMarkEntrySuggestion(
  input: MarkEntryAssistantRequestInput,
  user: AuthUser,
): Promise<TeacherAICopilotResult<MarkEntrySuggestionResult>> {
  const schoolId = getSchoolId(user);
  const supabase = await createSupabaseServerClient();

  const { data: classExists } = await supabase
    .from("classes")
    .select("class_id")
    .eq("school_id", schoolId)
    .eq("class_id", input.classId)
    .maybeSingle();

  if (!classExists) {
    throw new Error("Class not found in this school.");
  }

  if (input.studentId) {
    const { data: student } = await supabase
      .from("students")
      .select("student_id, current_class_id")
      .eq("school_id", schoolId)
      .eq("student_id", input.studentId)
      .maybeSingle();

    if (!student || student.current_class_id !== input.classId) {
      throw new Error("Selected student does not belong to the selected class.");
    }
  }

  const deterministic = deterministicMarkSuggestion(input.rawMark, input.maxMark);

  try {
    const ai = await generateGroqCompletion<MarkEntrySuggestionResult>({
      system:
        "You are a CBC mark entry assistant for Kenyan schools. Suggest grade, performance level, and feedback using provided mark data. Return JSON only.",
      prompt: [
        "Output schema:",
        JSON.stringify({
          grade: "A | B | C | D | E",
          performanceLevel:
            "exceeding_expectation | meeting_expectation | approaching_expectation | below_expectation",
          scoreOnCbcScale: "1 | 2 | 3 | 4",
          comment: "string",
          rationale: "string",
        }),
        "",
        "Guidance:",
        "1. Map raw mark to realistic grade and CBC performance level.",
        "2. Keep comment concise and actionable.",
        "3. Use the deterministic baseline unless there is a strong reason to adjust.",
        "",
        `Input: ${JSON.stringify({
          rawMark: input.rawMark,
          maxMark: input.maxMark,
          baseline: deterministic,
        })}`,
      ].join("\n"),
      responseFormat: "json",
      temperature: 0.15,
      responseSchema: markEntrySchema,
      requestLabel: "teacher-ai.mark-entry-assistant",
      cache: {
        schoolId,
        classId: input.classId,
        subject: input.learningAreaId ?? "mark-entry",
      },
    });

    return {
      result: markEntrySchema.parse(ai.data),
      confidence: ai.confidence,
      warnings: ai.warnings ?? [],
      generatedAt: new Date().toISOString(),
    };
  } catch (error) {
    return {
      result: deterministic,
      confidence: 0.72,
      warnings: [
        "AI suggestion fallback used.",
        error instanceof Error ? error.message : "Unknown AI fallback reason.",
      ],
      generatedAt: new Date().toISOString(),
    };
  }
}

function deriveDeterministicInsights(signals: StudentSignal[]): ClassroomInsightsResult {
  const weakStudents = signals
    .filter((signal) => signal.assessmentCount > 0 && signal.averageScore < 2.3)
    .map((signal) => ({
      studentId: signal.studentId,
      name: signal.name,
      reasons: [`Average score is ${signal.averageScore.toFixed(2)} on CBC scale (1-4).`],
    }))
    .slice(0, 10);

  const strongPerformers = signals
    .filter(
      (signal) =>
        signal.assessmentCount > 0 &&
        signal.averageScore >= 3.5 &&
        signal.attendanceRate >= 90 &&
        signal.majorIncidents === 0,
    )
    .map((signal) => ({
      studentId: signal.studentId,
      name: signal.name,
      reasons: [
        `Strong scores (${signal.averageScore.toFixed(2)}).`,
        `Attendance is ${signal.attendanceRate.toFixed(1)}%.`,
      ],
    }))
    .slice(0, 10);

  const attentionNeeded = signals
    .filter(
      (signal) =>
        signal.attendanceRate < 75 ||
        signal.majorIncidents > 0 ||
        signal.disciplineCount >= 3 ||
        (signal.assessmentCount > 0 && signal.averageScore < 2),
    )
    .map((signal) => {
      const reasons: string[] = [];
      if (signal.attendanceRate < 75) {
        reasons.push(`Attendance is low (${signal.attendanceRate.toFixed(1)}%).`);
      }
      if (signal.majorIncidents > 0) {
        reasons.push(`${signal.majorIncidents} major/critical discipline incident(s).`);
      }
      if (signal.disciplineCount >= 3) {
        reasons.push(`${signal.disciplineCount} total discipline incidents.`);
      }
      if (signal.assessmentCount > 0 && signal.averageScore < 2) {
        reasons.push(`Very low academic score (${signal.averageScore.toFixed(2)}).`);
      }

      return {
        studentId: signal.studentId,
        name: signal.name,
        reasons,
      };
    })
    .slice(0, 10);

  return {
    weakStudents,
    strongPerformers,
    attentionNeeded,
    classSummary:
      "Deterministic summary generated from assessments, attendance, and discipline signals.",
  };
}

export async function generateClassroomInsights(
  input: ClassroomInsightsRequestInput,
  user: AuthUser,
): Promise<TeacherAICopilotResult<ClassroomInsightsResult>> {
  const schoolId = getSchoolId(user);
  const supabase = await createSupabaseServerClient();
  const context = await resolveAcademicContext(schoolId, {
    termId: input.termId,
    academicYearId: input.academicYearId,
  });

  const { data: classExists } = await supabase
    .from("classes")
    .select("class_id, name")
    .eq("school_id", schoolId)
    .eq("class_id", input.classId)
    .maybeSingle();

  if (!classExists) {
    throw new Error("Class not found in this school.");
  }

  const { data: students, error: studentsError } = await supabase
    .from("students")
    .select("student_id, first_name, last_name")
    .eq("school_id", schoolId)
    .eq("current_class_id", input.classId)
    .eq("status", "active");

  if (studentsError) {
    throw new Error(`Failed to load class students: ${studentsError.message}`);
  }

  const roster = (students ?? []).map((row: any) => ({
    studentId: row.student_id as string,
    name: buildStudentName(row),
  }));
  const studentIds = roster.map((row) => row.studentId);

  if (studentIds.length === 0) {
    return {
      result: {
        weakStudents: [],
        strongPerformers: [],
        attentionNeeded: [],
        classSummary: "No active students found in the selected class.",
      },
      confidence: 0.9,
      warnings: ["No students found for the selected class."],
      generatedAt: new Date().toISOString(),
    };
  }

  const lookbackStart = new Date();
  lookbackStart.setDate(lookbackStart.getDate() - input.lookbackDays);
  const lookbackStartIso = lookbackStart.toISOString().slice(0, 10);

  let assessmentsQuery = supabase
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
  if (input.learningAreaId) {
    assessmentsQuery = assessmentsQuery.eq("learning_area_id", input.learningAreaId);
  }

  const { data: assessments, error: assessmentsError } = await assessmentsQuery;
  if (assessmentsError) {
    throw new Error(`Failed to load class assessments: ${assessmentsError.message}`);
  }

  let attendanceQuery = supabase
    .from("attendance")
    .select("student_id, status, date")
    .eq("school_id", schoolId)
    .eq("class_id", input.classId)
    .in("student_id", studentIds)
    .gte("date", lookbackStartIso);

  if (context.termId) {
    attendanceQuery = attendanceQuery.eq("term_id", context.termId);
  }

  const { data: attendanceRows, error: attendanceError } = await attendanceQuery;
  if (attendanceError) {
    throw new Error(`Failed to load class attendance: ${attendanceError.message}`);
  }

  let disciplineQuery = supabase
    .from("disciplinary_records")
    .select("student_id, severity, status, incident_type, incident_date")
    .eq("school_id", schoolId)
    .in("student_id", studentIds)
    .gte("incident_date", lookbackStartIso);

  if (context.termStartDate) {
    disciplineQuery = disciplineQuery.gte("incident_date", context.termStartDate);
  }
  if (context.termEndDate) {
    disciplineQuery = disciplineQuery.lte("incident_date", context.termEndDate);
  }

  const { data: disciplineRows, error: disciplineError } = await disciplineQuery;
  if (disciplineError) {
    throw new Error(`Failed to load discipline data: ${disciplineError.message}`);
  }

  const scoreMap = new Map<string, number[]>();
  for (const row of assessments ?? []) {
    const studentId = row.student_id as string;
    if (!scoreMap.has(studentId)) {
      scoreMap.set(studentId, []);
    }
    scoreMap.get(studentId)!.push(Number(row.score));
  }

  const attendanceMap = new Map<string, { total: number; presentLike: number }>();
  for (const row of attendanceRows ?? []) {
    const studentId = row.student_id as string;
    if (!attendanceMap.has(studentId)) {
      attendanceMap.set(studentId, { total: 0, presentLike: 0 });
    }
    const entry = attendanceMap.get(studentId)!;
    entry.total += 1;
    if (row.status === "present" || row.status === "late") {
      entry.presentLike += 1;
    }
  }

  const disciplineMap = new Map<string, { total: number; major: number }>();
  for (const row of disciplineRows ?? []) {
    const studentId = row.student_id as string;
    if (!disciplineMap.has(studentId)) {
      disciplineMap.set(studentId, { total: 0, major: 0 });
    }
    const entry = disciplineMap.get(studentId)!;
    entry.total += 1;
    if (row.severity === "major" || row.severity === "critical") {
      entry.major += 1;
    }
  }

  const signals: StudentSignal[] = roster.map((student) => {
    const scores = scoreMap.get(student.studentId) ?? [];
    const attendance = attendanceMap.get(student.studentId) ?? { total: 0, presentLike: 0 };
    const discipline = disciplineMap.get(student.studentId) ?? { total: 0, major: 0 };
    const averageScore =
      scores.length > 0 ? scores.reduce((sum, value) => sum + value, 0) / scores.length : 0;
    const attendanceRate =
      attendance.total > 0 ? (attendance.presentLike / attendance.total) * 100 : 0;

    return {
      studentId: student.studentId,
      name: student.name,
      averageScore: Number(averageScore.toFixed(2)),
      assessmentCount: scores.length,
      attendanceRate: Number(attendanceRate.toFixed(1)),
      attendanceRecords: attendance.total,
      disciplineCount: discipline.total,
      majorIncidents: discipline.major,
    };
  });

  const deterministic = deriveDeterministicInsights(signals);
  const rosterMap = new Map(roster.map((student) => [student.studentId, student.name]));

  try {
    const ai = await generateGroqCompletion<ClassroomInsightsResult>({
      system:
        "You are a classroom analytics assistant. Use only the supplied student signals from assessments, attendance, and discipline data. Return JSON only.",
      prompt: [
        "Output schema:",
        JSON.stringify({
          weakStudents: [{ studentId: "uuid", name: "string", reasons: ["string"] }],
          strongPerformers: [{ studentId: "uuid", name: "string", reasons: ["string"] }],
          attentionNeeded: [{ studentId: "uuid", name: "string", reasons: ["string"] }],
          classSummary: "string",
        }),
        "",
        "Rules:",
        "1. Select only students from provided signal list.",
        "2. Base reasons strictly on given metrics.",
        "3. Keep reasons short and actionable.",
        "4. Use at most 10 students per list.",
        "",
        `Class context: ${JSON.stringify({
          classId: input.classId,
          learningAreaId: input.learningAreaId ?? null,
          lookbackDays: input.lookbackDays,
          termId: context.termId,
          academicYearId: context.academicYearId,
        })}`,
        `Student signals: ${JSON.stringify(signals)}`,
        `Deterministic baseline: ${JSON.stringify(deterministic)}`,
      ].join("\n"),
      responseFormat: "json",
      temperature: 0.2,
      responseSchema: classroomInsightsSchema,
      requestLabel: "teacher-ai.classroom-insights",
      cache: {
        schoolId,
        classId: input.classId,
        subject: input.learningAreaId ?? "classroom-insights",
      },
    });

    const parsed = classroomInsightsSchema.parse(ai.data);
    const normalizeItems = (items: ClassroomInsightsResult["weakStudents"]) =>
      items
        .filter((item) => rosterMap.has(item.studentId))
        .map((item) => ({
          ...item,
          name: rosterMap.get(item.studentId) ?? item.name,
          reasons: item.reasons.slice(0, 4),
        }))
        .slice(0, 10);

    return {
      result: {
        weakStudents: normalizeItems(parsed.weakStudents),
        strongPerformers: normalizeItems(parsed.strongPerformers),
        attentionNeeded: normalizeItems(parsed.attentionNeeded),
        classSummary: parsed.classSummary,
      },
      confidence: ai.confidence,
      warnings: ai.warnings ?? [],
      generatedAt: new Date().toISOString(),
    };
  } catch (error) {
    return {
      result: deterministic,
      confidence: 0.74,
      warnings: [
        "AI insights fallback used.",
        error instanceof Error ? error.message : "Unknown AI fallback reason.",
      ],
      generatedAt: new Date().toISOString(),
    };
  }
}
