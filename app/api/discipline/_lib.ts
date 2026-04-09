
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { AuthUser } from "@/types/auth";

export type DisciplineSeverity = "minor" | "moderate" | "major" | "critical";
export type DisciplineStatus =
  | "reported"
  | "investigating"
  | "resolved"
  | "escalated";

export function firstRelation<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return value ?? null;
}

export function normalizeSeverity(
  value: string | null | undefined,
): DisciplineSeverity {
  switch (value) {
    case "critical":
    case "severe":
      return "critical";
    case "major":
      return "major";
    case "moderate":
      return "moderate";
    default:
      return "minor";
  }
}

export function normalizeStatus(
  value: string | null | undefined,
): DisciplineStatus {
  switch (value) {
    case "resolved":
    case "closed":
      return "resolved";
    case "escalated":
      return "escalated";
    case "in_progress":
    case "under_review":
    case "investigating":
      return "investigating";
    default:
      return "reported";
  }
}

export function mapIncomingStatus(
  value: string | null | undefined,
): DisciplineStatus {
  return normalizeStatus(value);
}

export async function getVisibleStudentIdsForUser(
  user: AuthUser,
): Promise<string[] | null> {
  const supabase = await createSupabaseServerClient();

  if (user.role === "class_teacher") {
    const { data: classes, error: classesError } = await supabase
      .from("classes")
      .select("class_id")
      .eq("school_id", user.schoolId!)
      .eq("class_teacher_id", user.id)
      .eq("is_active", true);

    if (classesError) {
      throw new Error(classesError.message);
    }

    const classIds = (classes ?? []).map((row: any) => row.class_id);
    if (classIds.length === 0) {
      return [];
    }

    const { data: students, error: studentsError } = await supabase
      .from("students")
      .select("student_id")
      .eq("school_id", user.schoolId!)
      .in("current_class_id", classIds);

    if (studentsError) {
      throw new Error(studentsError.message);
    }

    return (students ?? []).map((row: any) => row.student_id);
  }

  if (user.role === "parent") {
    const { data, error } = await supabase
      .from("student_guardians")
      .select("student_id")
      .eq("guardian_user_id", user.id);

    if (error) {
      throw new Error(error.message);
    }

    return (data ?? []).map((row: any) => row.student_id);
  }

  return null;
}

export async function buildClassMap(
  currentClassIds: string[],
): Promise<Map<string, { name: string; gradeName: string }>> {
  const classMap = new Map<string, { name: string; gradeName: string }>();
  if (currentClassIds.length === 0) {
    return classMap;
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("classes")
    .select("class_id, name, stream, grades(name)")
    .in("class_id", currentClassIds);

  if (error) {
    throw new Error(error.message);
  }

  (data ?? []).forEach((row: any) => {
    const grade = firstRelation(row.grades);
    const name = `${row.name}${row.stream ? ` ${row.stream}` : ""}`.trim();
    classMap.set(row.class_id, {
      name,
      gradeName: grade?.name ?? "",
    });
  });

  return classMap;
}

export async function mapDisciplineRows(rows: any[]) {
  const classIds = Array.from(
    new Set(
      rows
        .map((row) => firstRelation(row.student)?.current_class_id)
        .filter(Boolean),
    ),
  ) as string[];
  const classMap = await buildClassMap(classIds);

  return rows.map((row) => mapDisciplineRow(row, classMap));
}

export function mapDisciplineRow(
  row: any,
  classMap: Map<string, { name: string; gradeName: string }>,
) {
  const student = firstRelation(row.student);
  const recordedByUser = firstRelation(row.recorded_by_user);
  const resolvedByUser = firstRelation(row.resolved_by_user);
  const classEntry = student?.current_class_id
    ? classMap.get(student.current_class_id)
    : null;

  return {
    id: row.id,
    student_id: row.student_id,
    student: student
      ? {
          student_id: student.student_id,
          first_name: student.first_name,
          last_name: student.last_name,
          name: `${student.first_name ?? ""} ${student.last_name ?? ""}`.trim(),
          admission_number: student.admission_number,
          photo_url: student.photo_url ?? null,
          class_name: classEntry?.name ?? null,
          current_class: classEntry
            ? {
                name: classEntry.name,
                grade: { name: classEntry.gradeName },
              }
            : null,
        }
      : null,
    incident_date: row.incident_date,
    incident_type: row.incident_type,
    severity: normalizeSeverity(row.severity),
    description: row.description,
    location: row.location ?? null,
    witnesses: row.witnesses ?? null,
    action_taken: row.action_taken ?? null,
    action_details: row.action_details ?? null,
    status: normalizeStatus(row.status),
    follow_up_date: row.follow_up_date ?? null,
    follow_up_notes: row.follow_up_notes ?? null,
    parent_notified: row.parent_notified ?? false,
    parent_notified_date: row.parent_notified_date ?? null,
    recorded_by: row.recorded_by,
    recorded_by_user: recordedByUser
      ? {
          user_id: recordedByUser.user_id,
          first_name: recordedByUser.first_name,
          last_name: recordedByUser.last_name,
        }
      : null,
    resolved_by: row.resolved_by ?? null,
    resolved_by_user: resolvedByUser
      ? {
          user_id: resolvedByUser.user_id,
          first_name: resolvedByUser.first_name,
          last_name: resolvedByUser.last_name,
        }
      : null,
    resolved_at: row.resolved_at ?? null,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export function buildDisciplineSummary(rows: any[]) {
  const now = new Date();
  const currentMonthKey = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
  const previousMonthDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
  const previousMonthKey = `${previousMonthDate.getUTCFullYear()}-${String(previousMonthDate.getUTCMonth() + 1).padStart(2, "0")}`;

  const bySeverity = {
    minor: 0,
    moderate: 0,
    major: 0,
    critical: 0,
  };
  const byStatus = {
    reported: 0,
    investigating: 0,
    resolved: 0,
    escalated: 0,
  };
  const byTypeMap = new Map<string, number>();
  const studentIncidentMap = new Map<
    string,
    { student_name: string; admission_number: string; incident_count: number }
  >();

  let thisMonth = 0;
  let lastMonth = 0;

  rows.forEach((row) => {
    const severity = normalizeSeverity(row.severity);
    const status = normalizeStatus(row.status);
    bySeverity[severity] += 1;
    byStatus[status] += 1;

    byTypeMap.set(
      row.incident_type,
      (byTypeMap.get(row.incident_type) ?? 0) + 1,
    );

    const incidentDate = String(row.incident_date ?? "");
    const monthKey = incidentDate.slice(0, 7);
    if (monthKey === currentMonthKey) {
      thisMonth += 1;
    } else if (monthKey === previousMonthKey) {
      lastMonth += 1;
    }

    const student = firstRelation(row.student);
    if (student?.student_id) {
      const existing = studentIncidentMap.get(student.student_id);
      const studentName = `${student.first_name ?? ""} ${student.last_name ?? ""}`.trim();

      if (existing) {
        existing.incident_count += 1;
      } else {
        studentIncidentMap.set(student.student_id, {
          student_name: studentName,
          admission_number: student.admission_number ?? "",
          incident_count: 1,
        });
      }
    }
  });

  return {
    total: rows.length,
    open: rows.filter((row) => normalizeStatus(row.status) !== "resolved").length,
    resolved: byStatus.resolved,
    thisMonth,
    lastMonth,
    trend:
      lastMonth > 0
        ? Math.round(((thisMonth - lastMonth) / lastMonth) * 100)
        : thisMonth > 0
          ? 100
          : 0,
    bySeverity,
    byStatus,
    byType: Array.from(byTypeMap.entries())
      .map(([type, count]) => ({ type, count }))
      .sort((left, right) => right.count - left.count),
    repeatOffenders: Array.from(studentIncidentMap.entries())
      .filter(([, value]) => value.incident_count > 1)
      .map(([student_id, value]) => ({
        student_id,
        student_name: value.student_name,
        admission_number: value.admission_number,
        incident_count: value.incident_count,
      }))
      .sort((left, right) => right.incident_count - left.incident_count),
  };
}
