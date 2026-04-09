export const dynamic = 'force-dynamic';

// app/api/analytics/school/route.ts
// ============================================================
// GET /api/analytics/school - Get school-wide dashboard data
// ============================================================

import { NextRequest } from "next/server";
import { z } from "zod";
import { withPermission } from "@/lib/api/withAuth";
import { validateQuery } from "@/lib/api/validation";
import {
  errorResponse,
  successResponse,
  validationErrorResponse,
} from "@/lib/api/response";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  getAllClassesAttendanceSummary,
  getDailySchoolAttendance,
  getStudentAttendanceSummary,
} from "@/features/attendance/services/attendance.service";
import {
  createEmptyDashboardMetrics,
  type DashboardActivityItem,
  type DashboardMetrics,
} from "@/types/dashboard";
import {
  getCurrentFinanceSnapshot,
  type CurrentFinanceSnapshot,
} from "@/lib/finance/currentObligations";

const querySchema = z.object({
  termId: z.string().uuid().optional(),
  academicYearId: z.string().uuid().optional(),
});

const TEACHING_POSITIONS = [
  "principal",
  "deputy_principal",
  "class_teacher",
  "subject_teacher",
];

const TEACHER_ROLES = ["teacher", "class_teacher", "subject_teacher"];

export interface DashboardAnalyticsUser {
  id: string;
  schoolId: string;
  role: string;
}

function toNumber(value: unknown): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatPersonName(firstName?: string | null, lastName?: string | null) {
  return `${firstName ?? ""} ${lastName ?? ""}`.trim() || "Student";
}

function formatRelativeTimestamp(value?: string | null) {
  if (!value) {
    return "Recently";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "Recently";
  }

  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMinutes = Math.max(0, Math.floor(diffMs / 60000));

  if (diffMinutes < 1) {
    return "Just now";
  }

  if (diffMinutes < 60) {
    return `${diffMinutes}m ago`;
  }

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) {
    return `${diffHours}h ago`;
  }

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays === 1) {
    return "Yesterday";
  }

  if (diffDays < 7) {
    return `${diffDays}d ago`;
  }

  return date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
  });
}

function buildActivities(items: Array<DashboardActivityItem & { sortDate: string }>) {
  return items
    .sort(
      (left, right) =>
        new Date(right.sortDate).getTime() - new Date(left.sortDate).getTime(),
    )
    .slice(0, 8)
    .map(({ sortDate: _sortDate, ...item }) => item);
}

function isTeacherRole(role: string) {
  return TEACHER_ROLES.includes(role);
}

function isStudentRole(role: string) {
  return role === "student";
}

function isParentRole(role: string) {
  return role === "parent";
}

function summarizeFinanceSnapshot(snapshot: CurrentFinanceSnapshot | null) {
  if (!snapshot) {
    return {
      totalExpected: 0,
      totalCollected: 0,
      totalOutstanding: 0,
      pendingPayments: 0,
      collectionRate: 0,
    };
  }

  const studentsWithObligations = snapshot.students.filter(
    (student) => student.totalDue > 0,
  );
  const totalExpected = studentsWithObligations.reduce(
    (sum, student) => sum + student.totalDue,
    0,
  );
  const totalCollected = studentsWithObligations.reduce(
    (sum, student) => sum + student.totalPaid,
    0,
  );
  const totalOutstanding = studentsWithObligations.reduce(
    (sum, student) => sum + student.balance,
    0,
  );
  const pendingPayments = studentsWithObligations.filter(
    (student) => student.balance > 0,
  ).length;

  return {
    totalExpected: Math.round(totalExpected * 100) / 100,
    totalCollected: Math.round(totalCollected * 100) / 100,
    totalOutstanding: Math.round(totalOutstanding * 100) / 100,
    pendingPayments,
    collectionRate:
      totalExpected > 0
        ? Math.round(
            ((totalCollected / totalExpected) * 100 + Number.EPSILON) * 10,
          ) / 10
        : 0,
  };
}

function toAttendanceRate(present: number, late: number, total: number) {
  if (total <= 0) {
    return 0;
  }

  return Math.round((((present + late) / total) * 100 + Number.EPSILON) * 10) / 10;
}

function firstRelation<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return value ?? null;
}

async function buildTeacherMetrics(params: {
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>;
  user: { id: string; schoolId: string; role: string };
  academicYearId: string | null;
  termId: string | null;
  todayIso: string;
}): Promise<DashboardMetrics> {
  const { supabase, user, academicYearId, termId, todayIso } = params;
  const metrics = createEmptyDashboardMetrics();

  const { data: staff } = await supabase
    .from("staff")
    .select("staff_id")
    .eq("school_id", user.schoolId)
    .eq("user_id", user.id)
    .eq("status", "active")
    .maybeSingle();

  let classTeacherQuery: any = supabase
    .from("classes")
    .select("class_id")
    .eq("school_id", user.schoolId)
    .eq("is_active", true)
    .eq("class_teacher_id", user.id);

  if (academicYearId) {
    classTeacherQuery = classTeacherQuery.eq("academic_year_id", academicYearId);
  }

  let assignmentQuery: any = null;
  if (staff?.staff_id) {
    assignmentQuery = supabase
      .from("teacher_subjects")
      .select("class_id, learning_area_id")
      .eq("school_id", user.schoolId)
      .eq("teacher_id", staff.staff_id)
      .eq("is_active", true);

    if (academicYearId) {
      assignmentQuery = assignmentQuery.eq("academic_year_id", academicYearId);
    }
    if (termId) {
      assignmentQuery = assignmentQuery.eq("term_id", termId);
    }
  }

  const [classTeacherResult, assignmentResult, classAttendanceResult] =
    await Promise.all([
      classTeacherQuery,
      assignmentQuery ?? Promise.resolve({ data: [], error: null }),
      getAllClassesAttendanceSummary(user.schoolId, todayIso),
    ]);

  if (classTeacherResult.error) {
    throw new Error(classTeacherResult.error.message);
  }
  if (assignmentResult.error) {
    throw new Error(assignmentResult.error.message);
  }

  const assignedClassIds = Array.from(
    new Set([
      ...((classTeacherResult.data ?? []) as Array<{ class_id: string }>).map(
        (row) => row.class_id,
      ),
      ...((assignmentResult.data ?? []) as Array<{ class_id: string }>).map(
        (row) => row.class_id,
      ),
    ]),
  );

  const assignedLearningAreaIds = Array.from(
    new Set(
      ((assignmentResult.data ?? []) as Array<{ learning_area_id: string }>).map(
        (row) => row.learning_area_id,
      ),
    ),
  );

  metrics.assessments.totalCompleted = assignedClassIds.length;

  if (assignedClassIds.length === 0) {
    return metrics;
  }

  const [studentResult, disciplineResult, competencyResult, assessmentResult] =
    await Promise.all([
      supabase
        .from("students")
        .select("student_id, first_name, last_name, current_class_id, enrollment_date, created_at")
        .eq("school_id", user.schoolId)
        .eq("status", "active")
        .in("current_class_id", assignedClassIds),
      supabase
        .from("disciplinary_records")
        .select("id, student_id, incident_type, severity, status, incident_date, created_at")
        .eq("school_id", user.schoolId),
      assignedLearningAreaIds.length > 0
        ? supabase
            .from("competencies")
            .select(
              `
              competency_id,
              sub_strands (
                strands (
                  learning_area_id
                )
              )
            `,
            )
            .eq("school_id", user.schoolId)
        : Promise.resolve({ data: [], error: null }),
      (() => {
        let query: any = supabase
          .from("assessments")
          .select("assessment_id, class_id, learning_area_id, score, created_at")
          .eq("school_id", user.schoolId)
          .in("class_id", assignedClassIds);

        if (academicYearId) {
          query = query.eq("academic_year_id", academicYearId);
        }
        if (termId) {
          query = query.eq("term_id", termId);
        }

        if (assignedLearningAreaIds.length > 0) {
          query = query.in("learning_area_id", assignedLearningAreaIds);
        }

        return query;
      })(),
    ]);

  if (studentResult.error) {
    throw new Error(studentResult.error.message);
  }
  if (disciplineResult.error) {
    throw new Error(disciplineResult.error.message);
  }
  if (competencyResult.error) {
    throw new Error(competencyResult.error.message);
  }
  if (assessmentResult.error) {
    throw new Error(assessmentResult.error.message);
  }

  const classAttendance =
    classAttendanceResult.success && classAttendanceResult.data
      ? classAttendanceResult.data.filter((row) => assignedClassIds.includes(row.classId))
      : [];

  const totalStudents = classAttendance.reduce((sum, row) => sum + row.totalStudents, 0);
  const present = classAttendance.reduce((sum, row) => sum + row.present, 0);
  const absent = classAttendance.reduce((sum, row) => sum + row.absent, 0);
  const late = classAttendance.reduce((sum, row) => sum + row.late, 0);

  metrics.attendance.todayPresent = present;
  metrics.attendance.todayAbsent = absent;
  metrics.attendance.todayLate = late;
  metrics.attendance.todayRate = toAttendanceRate(present, late, totalStudents);

  const students = (studentResult.data ?? []) as Array<{
    student_id: string;
    first_name: string;
    last_name: string;
    current_class_id: string | null;
    enrollment_date: string | null;
    created_at: string | null;
  }>;
  const visibleStudentIds = new Set(students.map((row) => row.student_id));
  const classStudentCounts = new Map<string, number>();

  students.forEach((student) => {
    if (!student.current_class_id) {
      return;
    }
    classStudentCounts.set(
      student.current_class_id,
      (classStudentCounts.get(student.current_class_id) ?? 0) + 1,
    );
  });

  const competencyCounts = new Map<string, number>();
  ((competencyResult.data ?? []) as Array<any>).forEach((row) => {
    const subStrand = firstRelation(row?.sub_strands);
    const strand = firstRelation((subStrand as any)?.strands);
    const learningAreaId = strand?.learning_area_id as string | undefined;
    if (!learningAreaId || !assignedLearningAreaIds.includes(learningAreaId)) {
      return;
    }
    competencyCounts.set(
      learningAreaId,
      (competencyCounts.get(learningAreaId) ?? 0) + 1,
    );
  });

  const expectedAssessments = ((assignmentResult.data ?? []) as Array<{
    class_id: string;
    learning_area_id: string;
  }>).reduce((sum, row) => {
    const studentCount = classStudentCounts.get(row.class_id) ?? 0;
    const competencyCount = competencyCounts.get(row.learning_area_id) ?? 0;
    return sum + studentCount * competencyCount;
  }, 0);

  const assessments = (assessmentResult.data ?? []) as Array<{
    assessment_id: string;
    class_id: string;
    learning_area_id: string;
    score: number | string | null;
    created_at: string;
  }>;

  const totalScore = assessments.reduce((sum, row) => sum + toNumber(row.score), 0);
  metrics.assessments.pendingEntry = Math.max(expectedAssessments - assessments.length, 0);
  metrics.assessments.averageScore =
    assessments.length > 0
      ? Math.round(((totalScore / assessments.length) * 100 + Number.EPSILON)) / 100
      : 0;

  const disciplineRows = ((disciplineResult.data ?? []) as Array<{
    id: string;
    student_id: string;
    incident_type: string;
    severity: string | null;
    status: string | null;
    incident_date: string;
    created_at: string;
  }>).filter((row) => visibleStudentIds.has(row.student_id));

  metrics.discipline.openCases = disciplineRows.filter(
    (row) => !["resolved", "closed"].includes(String(row.status ?? "")),
  ).length;
  metrics.discipline.thisMonth = disciplineRows.filter(
    (row) => String(row.incident_date ?? "").slice(0, 7) === todayIso.slice(0, 7),
  ).length;

  metrics.recentActivity = buildActivities([
    ...(totalStudents > 0
      ? [
          {
            id: `attendance-${todayIso}`,
            type: "attendance" as const,
            title: "Class attendance updated",
            description: `${present} present, ${absent} absent, ${late} late across your classes`,
            timestamp: "Today",
            sortDate: new Date().toISOString(),
          },
        ]
      : []),
    ...assessments
      .slice()
      .sort(
        (left, right) =>
          new Date(right.created_at).getTime() - new Date(left.created_at).getTime(),
      )
      .slice(0, 5)
      .map((assessment) => ({
        id: `assessment-${assessment.assessment_id}`,
        type: "assessment" as const,
        title: "Assessment recorded",
        description: `Score ${toNumber(assessment.score).toFixed(1)} entered`,
        timestamp: formatRelativeTimestamp(assessment.created_at),
        sortDate: assessment.created_at,
      })),
    ...students
      .slice()
      .sort(
        (left, right) =>
          new Date(right.created_at ?? right.enrollment_date ?? todayIso).getTime() -
          new Date(left.created_at ?? left.enrollment_date ?? todayIso).getTime(),
      )
      .slice(0, 3)
      .map((student) => {
        const sortDate = student.created_at ?? student.enrollment_date ?? todayIso;
        return {
          id: `enrollment-${student.student_id}`,
          type: "enrollment" as const,
          title: "Student in your class list",
          description: formatPersonName(student.first_name, student.last_name),
          timestamp: formatRelativeTimestamp(sortDate),
          sortDate,
        };
      }),
    ...disciplineRows
      .slice()
      .sort(
        (left, right) =>
          new Date(right.created_at).getTime() - new Date(left.created_at).getTime(),
      )
      .slice(0, 3)
      .map((incident) => ({
        id: `discipline-${incident.id}`,
        type: "discipline" as const,
        title: "Discipline case in your classes",
        description: `${incident.incident_type} (${incident.severity ?? "minor"})`,
        timestamp: formatRelativeTimestamp(incident.created_at),
        sortDate: incident.created_at,
      })),
  ]);

  return metrics;
}

async function buildStudentMetrics(params: {
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>;
  user: { id: string; schoolId: string };
  academicYearId: string | null;
  termId: string | null;
  todayIso: string;
}): Promise<DashboardMetrics> {
  const { supabase, user, academicYearId, termId, todayIso } = params;
  const metrics = createEmptyDashboardMetrics();

  const { data: student, error: studentError } = await supabase
    .from("students")
    .select("student_id, first_name, last_name")
    .eq("school_id", user.schoolId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (studentError) {
    throw new Error(studentError.message);
  }

  if (!student?.student_id) {
    return metrics;
  }

  let assessmentsQuery: any = supabase
    .from("assessments")
    .select("assessment_id, score, created_at, assessment_date")
    .eq("school_id", user.schoolId)
    .eq("student_id", student.student_id);

  if (academicYearId) {
    assessmentsQuery = assessmentsQuery.eq("academic_year_id", academicYearId);
  }
  if (termId) {
    assessmentsQuery = assessmentsQuery.eq("term_id", termId);
  }

  const [attendanceResult, assessmentsResult] = await Promise.all([
    getStudentAttendanceSummary(student.student_id, user.schoolId, termId ?? undefined, academicYearId ?? undefined),
    assessmentsQuery.order("assessment_date", { ascending: false }),
  ]);

  if (assessmentsResult.error) {
    throw new Error(assessmentsResult.error.message);
  }

  if (attendanceResult.success && attendanceResult.data) {
    metrics.attendance.todayPresent = attendanceResult.data.present_days;
    metrics.attendance.todayAbsent = attendanceResult.data.absent_days;
    metrics.attendance.todayLate = attendanceResult.data.late_days;
    metrics.attendance.todayRate = attendanceResult.data.attendance_rate;
  }

  const assessments = (assessmentsResult.data ?? []) as Array<{
    assessment_id: string;
    score: number | string | null;
    created_at: string | null;
    assessment_date: string | null;
  }>;

  const totalScore = assessments.reduce((sum, row) => sum + toNumber(row.score), 0);
  metrics.assessments.totalCompleted = assessments.length;
  metrics.assessments.averageScore =
    assessments.length > 0
      ? Math.round(((totalScore / assessments.length) * 100 + Number.EPSILON)) / 100
      : 0;

  metrics.recentActivity = buildActivities([
    ...(attendanceResult.success && attendanceResult.data
      ? [
          {
            id: `attendance-${student.student_id}`,
            type: "attendance" as const,
            title: "Attendance summary",
            description: `${attendanceResult.data.present_days} present, ${attendanceResult.data.absent_days} absent, ${attendanceResult.data.late_days} late this term`,
            timestamp: "This term",
            sortDate: new Date().toISOString(),
          },
        ]
      : []),
    ...assessments.slice(0, 6).map((assessment) => {
      const sortDate = assessment.created_at ?? assessment.assessment_date ?? todayIso;
      return {
        id: `assessment-${assessment.assessment_id}`,
        type: "assessment" as const,
        title: "Assessment recorded",
        description: `Score ${toNumber(assessment.score).toFixed(1)} entered`,
        timestamp: formatRelativeTimestamp(sortDate),
        sortDate,
      };
    }),
  ]);

  return metrics;
}

async function buildParentMetrics(params: {
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>;
  user: { id: string; schoolId: string };
  academicYearId: string | null;
  termId: string | null;
  todayIso: string;
}): Promise<DashboardMetrics> {
  const { supabase, user, academicYearId, termId, todayIso } = params;
  const metrics = createEmptyDashboardMetrics();

  const { data: links, error: linksError } = await supabase
    .from("student_guardians")
    .select("student_id")
    .eq("school_id", user.schoolId)
    .eq("guardian_user_id", user.id);

  if (linksError) {
    throw new Error(linksError.message);
  }

  const studentIds = Array.from(
    new Set(((links ?? []) as Array<{ student_id: string }>).map((row) => row.student_id)),
  );

  if (studentIds.length === 0) {
    return metrics;
  }

  let attendanceQuery: any = supabase
    .from("attendance")
    .select("student_id, status")
    .eq("school_id", user.schoolId)
    .in("student_id", studentIds);

  if (termId) {
    attendanceQuery = attendanceQuery.eq("term_id", termId);
  }

  let assessmentsQuery: any = supabase
    .from("assessments")
    .select("assessment_id, student_id, score, created_at, assessment_date")
    .eq("school_id", user.schoolId)
    .in("student_id", studentIds);

  if (academicYearId) {
    assessmentsQuery = assessmentsQuery.eq("academic_year_id", academicYearId);
  }
  if (termId) {
    assessmentsQuery = assessmentsQuery.eq("term_id", termId);
  }

  const financeSnapshotPromise = academicYearId
    ? getCurrentFinanceSnapshot({
        supabase,
        schoolId: user.schoolId,
        academicYearId,
        termId,
        studentIds,
      })
    : Promise.resolve(null);

  const [studentsResult, attendanceResult, assessmentsResult, financeSnapshot] =
    await Promise.all([
      supabase
        .from("students")
        .select("student_id, first_name, last_name")
        .eq("school_id", user.schoolId)
        .in("student_id", studentIds),
      attendanceQuery,
      assessmentsQuery.order("assessment_date", { ascending: false }),
      financeSnapshotPromise,
    ]);

  if (studentsResult.error) {
    throw new Error(studentsResult.error.message);
  }
  if (attendanceResult.error) {
    throw new Error(attendanceResult.error.message);
  }
  if (assessmentsResult.error) {
    throw new Error(assessmentsResult.error.message);
  }
  const students = (studentsResult.data ?? []) as Array<{
    student_id: string;
    first_name: string;
    last_name: string;
  }>;
  const studentNames = new Map(
    students.map((student) => [
      student.student_id,
      formatPersonName(student.first_name, student.last_name),
    ]),
  );

  const attendanceRows = (attendanceResult.data ?? []) as Array<{
    student_id: string;
    status: string;
  }>;
  const present = attendanceRows.filter((row) => row.status === "present").length;
  const absent = attendanceRows.filter((row) => row.status === "absent").length;
  const late = attendanceRows.filter((row) => row.status === "late").length;
  metrics.attendance.todayPresent = present;
  metrics.attendance.todayAbsent = absent;
  metrics.attendance.todayLate = late;
  metrics.attendance.todayRate = toAttendanceRate(present, late, attendanceRows.length);

  const financeSummary = summarizeFinanceSnapshot(financeSnapshot);
  metrics.finance.totalExpected = financeSummary.totalExpected;
  metrics.finance.totalCollected = financeSummary.totalCollected;
  metrics.finance.collectionRate = financeSummary.collectionRate;
  metrics.finance.pendingPayments = financeSummary.pendingPayments;

  const assessments = (assessmentsResult.data ?? []) as Array<{
    assessment_id: string;
    student_id: string;
    score: number | string | null;
    created_at: string | null;
    assessment_date: string | null;
  }>;
  metrics.assessments.totalCompleted = assessments.length;
  metrics.assessments.averageScore =
    assessments.length > 0
      ? Math.round(
          ((assessments.reduce((sum, row) => sum + toNumber(row.score), 0) /
            assessments.length) *
            100 +
            Number.EPSILON),
        ) / 100
      : 0;

  metrics.recentActivity = buildActivities([
    ...(attendanceRows.length > 0
      ? [
          {
            id: `attendance-parent-${user.id}`,
            type: "attendance" as const,
            title: "Children attendance summary",
            description: `${present} present, ${absent} absent, ${late} late this term`,
            timestamp: "This term",
            sortDate: new Date().toISOString(),
          },
        ]
      : []),
    ...assessments.slice(0, 6).map((assessment) => {
      const sortDate = assessment.created_at ?? assessment.assessment_date ?? todayIso;
      return {
        id: `assessment-${assessment.assessment_id}`,
        type: "assessment" as const,
        title: "Assessment recorded",
        description: `${studentNames.get(assessment.student_id) ?? "Student"} scored ${toNumber(assessment.score).toFixed(1)}`,
        timestamp: formatRelativeTimestamp(sortDate),
        sortDate,
      };
    }),
  ]);

  return metrics;
}

async function getSchoolDashboardMetrics(params: {
  user: DashboardAnalyticsUser;
  academicYearId?: string | null;
  termId?: string | null;
}): Promise<DashboardMetrics> {
  const { user } = params;

  if (!user.schoolId) {
    return createEmptyDashboardMetrics();
  }

  const supabase = await createSupabaseServerClient();
  const metrics = createEmptyDashboardMetrics();

  let resolvedAcademicYearId = params.academicYearId ?? null;
  let resolvedTermId = params.termId ?? null;

  const [activeYearResult, activeTermResult] = await Promise.all([
    resolvedAcademicYearId
      ? Promise.resolve({ data: null, error: null })
      : supabase
          .from("academic_years")
          .select("academic_year_id")
          .eq("school_id", user.schoolId)
          .eq("is_active", true)
          .maybeSingle(),
    resolvedTermId
      ? Promise.resolve({ data: null, error: null })
      : supabase
          .from("terms")
          .select("term_id, academic_year_id, start_date, end_date")
          .eq("school_id", user.schoolId)
          .eq("is_active", true)
          .maybeSingle(),
  ]);

  if (!resolvedAcademicYearId) {
    resolvedAcademicYearId = activeYearResult.data?.academic_year_id ?? null;
  }

  let termWindow:
    | {
        term_id: string;
        academic_year_id: string;
        start_date: string;
        end_date: string;
      }
    | null = activeTermResult.data ?? null;

  if (!resolvedTermId) {
    resolvedTermId = termWindow?.term_id ?? null;
  }

  if (!resolvedAcademicYearId && termWindow?.academic_year_id) {
    resolvedAcademicYearId = termWindow.academic_year_id;
  }

  if (resolvedTermId && !termWindow) {
    const { data: selectedTerm, error: termError } = await supabase
      .from("terms")
      .select("term_id, academic_year_id, start_date, end_date")
      .eq("school_id", user.schoolId)
      .eq("term_id", resolvedTermId)
      .maybeSingle();

    if (termError) {
      throw new Error(termError.message);
    }

    termWindow = selectedTerm ?? null;

    if (!resolvedAcademicYearId && selectedTerm?.academic_year_id) {
      resolvedAcademicYearId = selectedTerm.academic_year_id;
    }
  }

  if (!resolvedTermId && resolvedAcademicYearId) {
    const { data: fallbackTerm, error: fallbackTermError } = await supabase
      .from("terms")
      .select("term_id, academic_year_id, start_date, end_date")
      .eq("school_id", user.schoolId)
      .eq("academic_year_id", resolvedAcademicYearId)
      .order("start_date", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (fallbackTermError) {
      throw new Error(fallbackTermError.message);
    }

    if (fallbackTerm) {
      resolvedTermId = fallbackTerm.term_id;
      termWindow = fallbackTerm;
    }
  }

  const todayIso = new Date().toISOString().split("T")[0];
  const monthStartIso = `${new Date().getFullYear()}-${String(
    new Date().getMonth() + 1,
  ).padStart(2, "0")}-01`;

  if (isTeacherRole(user.role)) {
    return buildTeacherMetrics({
      supabase,
      user,
      academicYearId: resolvedAcademicYearId,
      termId: resolvedTermId,
      todayIso,
    });
  }

  if (isStudentRole(user.role)) {
    return buildStudentMetrics({
      supabase,
      user,
      academicYearId: resolvedAcademicYearId,
      termId: resolvedTermId,
      todayIso,
    });
  }

  if (isParentRole(user.role)) {
    return buildParentMetrics({
      supabase,
      user,
      academicYearId: resolvedAcademicYearId,
      termId: resolvedTermId,
      todayIso,
    });
  }

  let newStudentsQuery: any = supabase
    .from("students")
    .select("student_id", { count: "exact", head: true })
    .eq("school_id", user.schoolId);

  if (termWindow?.start_date && termWindow?.end_date) {
    newStudentsQuery = newStudentsQuery
      .gte("enrollment_date", termWindow.start_date)
      .lte("enrollment_date", termWindow.end_date);
  } else {
    newStudentsQuery = newStudentsQuery.gte("enrollment_date", monthStartIso);
  }

  const financeSnapshotPromise = resolvedAcademicYearId
    ? getCurrentFinanceSnapshot({
        supabase,
        schoolId: user.schoolId,
        academicYearId: resolvedAcademicYearId,
        termId: resolvedTermId,
      })
    : Promise.resolve(null);

  let assessmentsQuery: any = supabase
    .from("assessments")
    .select("assessment_id, student_id, score, created_at")
    .eq("school_id", user.schoolId);

  if (resolvedAcademicYearId) {
    assessmentsQuery = assessmentsQuery.eq(
      "academic_year_id",
      resolvedAcademicYearId,
    );
  }
  if (resolvedTermId) {
    assessmentsQuery = assessmentsQuery.eq("term_id", resolvedTermId);
  }

  const [
    totalStudentsResult,
    activeStudentsResult,
    newStudentsResult,
    recentStudentsResult,
    totalStaffResult,
    teachingStaffResult,
    onLeaveResult,
    financeSnapshot,
    recentPaymentsResult,
    assessmentsResult,
    disciplineResult,
    attendanceResult,
  ] = await Promise.all([
    supabase
      .from("students")
      .select("student_id", { count: "exact", head: true })
      .eq("school_id", user.schoolId),
    supabase
      .from("students")
      .select("student_id", { count: "exact", head: true })
      .eq("school_id", user.schoolId)
      .eq("status", "active"),
    newStudentsQuery,
    supabase
      .from("students")
      .select("student_id, first_name, last_name, enrollment_date, created_at")
      .eq("school_id", user.schoolId)
      .order("created_at", { ascending: false })
      .limit(5),
    supabase
      .from("staff")
      .select("staff_id", { count: "exact", head: true })
      .eq("school_id", user.schoolId),
    supabase
      .from("staff")
      .select("staff_id", { count: "exact", head: true })
      .eq("school_id", user.schoolId)
      .in("position", TEACHING_POSITIONS),
    supabase
      .from("staff_leaves")
      .select("leave_id", { count: "exact", head: true })
      .eq("school_id", user.schoolId)
      .eq("status", "approved")
      .lte("start_date", todayIso)
      .gte("end_date", todayIso),
    financeSnapshotPromise,
    supabase
      .from("payments")
      .select("id, amount_paid, payment_method, payment_date, created_at")
      .eq("school_id", user.schoolId)
      .order("created_at", { ascending: false })
      .limit(5),
    assessmentsQuery,
    supabase
      .from("disciplinary_records")
      .select("id, incident_type, severity, status, incident_date, created_at")
      .eq("school_id", user.schoolId),
    getDailySchoolAttendance(user.schoolId, todayIso),
  ]);

  const countErrors = [
    totalStudentsResult.error,
    activeStudentsResult.error,
    newStudentsResult.error,
    recentStudentsResult.error,
    totalStaffResult.error,
    teachingStaffResult.error,
    onLeaveResult.error,
    recentPaymentsResult.error,
    assessmentsResult.error,
    disciplineResult.error,
  ].filter(Boolean);

  if (countErrors.length > 0) {
    throw new Error(countErrors[0]!.message);
  }

  metrics.students.total = totalStudentsResult.count ?? 0;
  metrics.students.active = activeStudentsResult.count ?? 0;
  metrics.students.newThisTerm = newStudentsResult.count ?? 0;

  metrics.staff.total = totalStaffResult.count ?? 0;
  metrics.staff.teachers = teachingStaffResult.count ?? 0;
  metrics.staff.onLeave = onLeaveResult.count ?? 0;

  const financeSummary = summarizeFinanceSnapshot(financeSnapshot);
  metrics.finance.totalExpected = financeSummary.totalExpected;
  metrics.finance.totalCollected = financeSummary.totalCollected;
  metrics.finance.collectionRate = financeSummary.collectionRate;
  metrics.finance.pendingPayments = financeSummary.pendingPayments;

  if (attendanceResult.success && attendanceResult.data) {
    metrics.attendance.todayPresent = attendanceResult.data.present;
    metrics.attendance.todayAbsent = attendanceResult.data.absent;
    metrics.attendance.todayLate = attendanceResult.data.late;
    metrics.attendance.todayRate = attendanceResult.data.attendanceRate;
  }

  const assessmentRows = (assessmentsResult.data ?? []) as Array<{
    assessment_id: string;
    student_id: string;
    score: number | string | null;
    created_at: string;
  }>;

  const totalAssessmentScore = assessmentRows.reduce(
    (sum, row) => sum + toNumber(row.score),
    0,
  );
  const assessedStudents = new Set(assessmentRows.map((row) => row.student_id));

  metrics.assessments.totalCompleted = assessmentRows.length;
  metrics.assessments.pendingEntry = Math.max(
    metrics.students.active - assessedStudents.size,
    0,
  );
  metrics.assessments.averageScore =
    assessmentRows.length > 0
      ? Math.round(
          ((totalAssessmentScore / assessmentRows.length) * 100 + Number.EPSILON),
        ) / 100
      : 0;

  const disciplineRows = (disciplineResult.data ?? []) as Array<{
    id: string;
    incident_type: string;
    severity: string | null;
    status: string | null;
    incident_date: string;
    created_at: string;
  }>;

  const currentMonthKey = todayIso.slice(0, 7);

  metrics.discipline.openCases = disciplineRows.filter(
    (row) => !["resolved", "closed"].includes(String(row.status ?? "")),
  ).length;
  metrics.discipline.thisMonth = disciplineRows.filter(
    (row) => String(row.incident_date ?? "").slice(0, 7) === currentMonthKey,
  ).length;

  metrics.recentActivity = buildActivities([
    ...(attendanceResult.success &&
    attendanceResult.data &&
    attendanceResult.data.totalStudents > 0
      ? [
          {
            id: `attendance-${todayIso}`,
            type: "attendance" as const,
            title: "Attendance summary updated",
            description: `${attendanceResult.data.present} present, ${attendanceResult.data.absent} absent, ${attendanceResult.data.late} late today`,
            timestamp: "Today",
            sortDate: new Date().toISOString(),
          },
        ]
      : []),
    ...((recentPaymentsResult.data ?? []) as Array<{
      id: string;
      amount_paid: number | string | null;
      payment_method: string | null;
      payment_date: string | null;
      created_at: string | null;
    }>).map((payment) => {
      const sortDate = payment.created_at ?? payment.payment_date ?? todayIso;
      return {
        id: `payment-${payment.id}`,
        type: "payment" as const,
        title: "Payment received",
        description: `${payment.payment_method ?? "Payment"} of ${toNumber(
          payment.amount_paid,
        ).toLocaleString()}`,
        timestamp: formatRelativeTimestamp(sortDate),
        amount: toNumber(payment.amount_paid),
        sortDate,
      };
    }),
    ...assessmentRows
      .slice()
      .sort(
        (left, right) =>
          new Date(right.created_at).getTime() - new Date(left.created_at).getTime(),
      )
      .slice(0, 5)
      .map((assessment) => ({
        id: `assessment-${assessment.assessment_id}`,
        type: "assessment" as const,
        title: "Assessment recorded",
        description: `Score ${toNumber(assessment.score).toFixed(1)} entered`,
        timestamp: formatRelativeTimestamp(assessment.created_at),
        sortDate: assessment.created_at,
      })),
    ...((recentStudentsResult.data ?? []) as Array<{
      student_id: string;
      first_name: string;
      last_name: string;
      enrollment_date: string | null;
      created_at: string | null;
    }>).map((student) => {
      const sortDate = student.created_at ?? student.enrollment_date ?? todayIso;
      return {
        id: `enrollment-${student.student_id}`,
        type: "enrollment" as const,
        title: "New student enrolled",
        description: formatPersonName(student.first_name, student.last_name),
        timestamp: formatRelativeTimestamp(sortDate),
        sortDate,
      };
    }),
    ...disciplineRows
      .slice()
      .sort(
        (left, right) =>
          new Date(right.created_at).getTime() - new Date(left.created_at).getTime(),
      )
      .slice(0, 5)
      .map((incident) => ({
        id: `discipline-${incident.id}`,
        type: "discipline" as const,
        title: "Discipline case recorded",
        description: `${incident.incident_type} (${incident.severity ?? "minor"})`,
        timestamp: formatRelativeTimestamp(
          incident.created_at ?? incident.incident_date,
        ),
        sortDate: incident.created_at ?? incident.incident_date,
      })),
  ]);

  return metrics;
}

export const GET = withPermission(
  "analytics",
  "view",
  async (request: NextRequest, { user }) => {
    const { searchParams } = new URL(request.url);
    const validation = validateQuery(searchParams, querySchema);

    if (!validation.success) {
      return validationErrorResponse(validation.errors!);
    }

    try {
      return successResponse(
        await getSchoolDashboardMetrics({
          user: {
            id: user.id,
            schoolId: user.schoolId ?? "",
            role: user.role,
          },
          academicYearId: validation.data?.academicYearId ?? null,
          termId: validation.data?.termId ?? null,
        }),
      );
    } catch (error) {
      return errorResponse(
        error instanceof Error
          ? error.message
          : "Failed to load dashboard analytics",
        500,
      );
    }
  },
);
