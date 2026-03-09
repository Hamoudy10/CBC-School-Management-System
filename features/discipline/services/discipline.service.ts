// features/discipline/services/discipline.service.ts
// Disciplinary records CRUD service

import { createClient } from "@/lib/supabase/client";
import type {
  DisciplinaryRecord,
  DisciplineFilters,
  DisciplineSummary,
  CreateDisciplineInput,
  UpdateDisciplineInput,
} from "../types";

const supabase = createClient();

// ============================================================
// CREATE
// ============================================================

export async function createDisciplinaryRecord(
  input: CreateDisciplineInput,
  recordedBy: string,
  schoolId: string,
): Promise<{ success: boolean; id?: string; message: string }> {
  // Verify student exists and belongs to school
  const { data: student, error: studentError } = await supabase
    .from("students")
    .select("student_id, status")
    .eq("student_id", input.student_id)
    .eq("school_id", schoolId)
    .single();

  if (studentError || !student) {
    return { success: false, message: "Student not found in this school" };
  }

  if (student.status !== "active") {
    return {
      success: false,
      message: "Cannot record discipline for inactive student",
    };
  }

  const { data, error } = await supabase
    .from("disciplinary_records")
    .insert({
      student_id: input.student_id,
      incident_type: input.incident_type,
      severity: input.severity,
      description: input.description,
      date: input.date,
      time: input.time || null,
      location: input.location || null,
      witnesses: input.witnesses || null,
      action_taken: input.action_taken,
      action_details: input.action_details || null,
      status: "open",
      parent_notified: input.parent_notified,
      parent_notified_date: input.parent_notified_date || null,
      recorded_by: recordedBy,
      school_id: schoolId,
      term: input.term,
      academic_year: input.academic_year,
    })
    .select("id")
    .single();

  if (error) {
    return { success: false, message: error.message };
  }

  return { success: true, id: data.id, message: "Disciplinary record created" };
}

// ============================================================
// READ
// ============================================================

export async function getDisciplinaryRecord(
  recordId: string,
  schoolId: string,
): Promise<{ success: boolean; data?: DisciplinaryRecord; message?: string }> {
  const { data, error } = await supabase
    .from("disciplinary_records")
    .select(
      `
      *,
      student:students(
        student_id,
        admission_no,
        user:users(first_name, last_name)
      ),
      recorder:users!recorded_by(first_name, last_name),
      reviewer:users!reviewed_by(first_name, last_name)
    `,
    )
    .eq("id", recordId)
    .eq("school_id", schoolId)
    .single();

  if (error) {
    return { success: false, message: error.message };
  }

  return { success: true, data: data as unknown as DisciplinaryRecord };
}

export async function getDisciplinaryRecords(
  filters: DisciplineFilters,
  schoolId: string,
  page: number = 1,
  pageSize: number = 20,
): Promise<{
  success: boolean;
  data: DisciplinaryRecord[];
  total: number;
  message?: string;
}> {
  const safePage = Math.max(1, page);
  const safePageSize = Math.min(Math.max(1, pageSize), 100);
  const offset = (safePage - 1) * safePageSize;

  let query = supabase
    .from("disciplinary_records")
    .select(
      `
      *,
      student:students(
        student_id,
        admission_no,
        user:users(first_name, last_name)
      ),
      recorder:users!recorded_by(first_name, last_name)
    `,
      { count: "exact" },
    )
    .eq("school_id", schoolId);

  if (filters.student_id) {
    query = query.eq("student_id", filters.student_id);
  }
  if (filters.incident_type) {
    query = query.eq("incident_type", filters.incident_type);
  }
  if (filters.severity) {
    query = query.eq("severity", filters.severity);
  }
  if (filters.status) {
    query = query.eq("status", filters.status);
  }
  if (filters.date_from) {
    query = query.gte("date", filters.date_from);
  }
  if (filters.date_to) {
    query = query.lte("date", filters.date_to);
  }
  if (filters.term) {
    query = query.eq("term", filters.term);
  }
  if (filters.academic_year) {
    query = query.eq("academic_year", filters.academic_year);
  }

  const { data, error, count } = await query
    .order("date", { ascending: false })
    .order("created_at", { ascending: false })
    .range(offset, offset + safePageSize - 1);

  if (error) {
    return { success: false, data: [], total: 0, message: error.message };
  }

  return {
    success: true,
    data: (data || []) as unknown as DisciplinaryRecord[],
    total: count || 0,
  };
}

// ============================================================
// UPDATE
// ============================================================

export async function updateDisciplinaryRecord(
  recordId: string,
  input: UpdateDisciplineInput,
  schoolId: string,
): Promise<{ success: boolean; message: string }> {
  // Verify record exists
  const { data: existing, error: existError } = await supabase
    .from("disciplinary_records")
    .select("id, status")
    .eq("id", recordId)
    .eq("school_id", schoolId)
    .single();

  if (existError || !existing) {
    return { success: false, message: "Disciplinary record not found" };
  }

  if (existing.status === "closed") {
    return {
      success: false,
      message: "Cannot update a closed disciplinary record",
    };
  }

  const updateData: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  if (input.status !== undefined) updateData.status = input.status;
  if (input.action_taken !== undefined)
    updateData.action_taken = input.action_taken;
  if (input.action_details !== undefined)
    updateData.action_details = input.action_details;
  if (input.follow_up_date !== undefined)
    updateData.follow_up_date = input.follow_up_date;
  if (input.follow_up_notes !== undefined)
    updateData.follow_up_notes = input.follow_up_notes;
  if (input.parent_notified !== undefined)
    updateData.parent_notified = input.parent_notified;
  if (input.parent_notified_date !== undefined)
    updateData.parent_notified_date = input.parent_notified_date;
  if (input.reviewed_by !== undefined)
    updateData.reviewed_by = input.reviewed_by;

  const { error } = await supabase
    .from("disciplinary_records")
    .update(updateData)
    .eq("id", recordId)
    .eq("school_id", schoolId);

  if (error) {
    return { success: false, message: error.message };
  }

  return { success: true, message: "Disciplinary record updated" };
}

// ============================================================
// SUMMARIES
// ============================================================

export async function getDisciplineSummary(
  schoolId: string,
  filters?: {
    class_id?: string;
    term?: string;
    academic_year?: string;
    date_from?: string;
    date_to?: string;
  },
): Promise<{ success: boolean; data?: DisciplineSummary; message?: string }> {
  let query = supabase
    .from("disciplinary_records")
    .select(
      `
      *,
      student:students(
        student_id,
        admission_no,
        current_class_id,
        user:users(first_name, last_name)
      )
    `,
    )
    .eq("school_id", schoolId);

  if (filters?.class_id) {
    // Need to filter by student's class
    const { data: classStudents } = await supabase
      .from("student_classes")
      .select("student_id")
      .eq("class_id", filters.class_id)
      .eq("school_id", schoolId)
      .eq("status", "active");

    if (classStudents && classStudents.length > 0) {
      const studentIds = classStudents.map((s) => s.student_id);
      query = query.in("student_id", studentIds);
    } else {
      // No students in class, return empty summary
      return {
        success: true,
        data: {
          total_incidents: 0,
          by_type: {} as Record<string, number>,
          by_severity: {} as Record<string, number>,
          by_status: {} as Record<string, number>,
          by_action: {} as Record<string, number>,
          by_month: [],
          repeat_offenders: [],
        } as DisciplineSummary,
      };
    }
  }

  if (filters?.term) query = query.eq("term", filters.term);
  if (filters?.academic_year)
    query = query.eq("academic_year", filters.academic_year);
  if (filters?.date_from) query = query.gte("date", filters.date_from);
  if (filters?.date_to) query = query.lte("date", filters.date_to);

  const { data, error } = await query.order("date", { ascending: false });

  if (error) {
    return { success: false, message: error.message };
  }

  const records = data || [];

  // By type
  const byType: Record<string, number> = {};
  records.forEach((r) => {
    byType[r.incident_type] = (byType[r.incident_type] || 0) + 1;
  });

  // By severity
  const bySeverity: Record<string, number> = {};
  records.forEach((r) => {
    bySeverity[r.severity] = (bySeverity[r.severity] || 0) + 1;
  });

  // By status
  const byStatus: Record<string, number> = {};
  records.forEach((r) => {
    byStatus[r.status] = (byStatus[r.status] || 0) + 1;
  });

  // By action
  const byAction: Record<string, number> = {};
  records.forEach((r) => {
    byAction[r.action_taken] = (byAction[r.action_taken] || 0) + 1;
  });

  // By month
  const monthMap = new Map<string, number>();
  records.forEach((r) => {
    const month = r.date.substring(0, 7);
    monthMap.set(month, (monthMap.get(month) || 0) + 1);
  });
  const byMonth = Array.from(monthMap.entries())
    .map(([month, count]) => ({ month, count }))
    .sort((a, b) => a.month.localeCompare(b.month));

  // Repeat offenders (3+ incidents)
  const studentCounts = new Map<string, { count: number; name: string }>();
  records.forEach((r) => {
    const existing = studentCounts.get(r.student_id);
    const studentData = r.student as unknown as {
      user: { first_name: string; last_name: string };
    };
    const name = studentData?.user
      ? `${studentData.user.first_name} ${studentData.user.last_name}`
      : "Unknown";

    if (existing) {
      existing.count++;
    } else {
      studentCounts.set(r.student_id, { count: 1, name });
    }
  });

  const repeatOffenders = Array.from(studentCounts.entries())
    .filter(([, v]) => v.count >= 3)
    .map(([studentId, v]) => ({
      student_id: studentId,
      student_name: v.name,
      incident_count: v.count,
    }))
    .sort((a, b) => b.incident_count - a.incident_count);

  const summary: DisciplineSummary = {
    total_incidents: records.length,
    by_type: byType as DisciplineSummary["by_type"],
    by_severity: bySeverity as DisciplineSummary["by_severity"],
    by_status: byStatus as DisciplineSummary["by_status"],
    by_action: byAction as DisciplineSummary["by_action"],
    by_month: byMonth,
    repeat_offenders: repeatOffenders,
  };

  return { success: true, data: summary };
}

export async function getStudentDisciplineHistory(
  studentId: string,
  schoolId: string,
): Promise<{
  success: boolean;
  data: DisciplinaryRecord[];
  total: number;
  message?: string;
}> {
  const { data, error, count } = await supabase
    .from("disciplinary_records")
    .select(
      `
      *,
      recorder:users!recorded_by(first_name, last_name),
      reviewer:users!reviewed_by(first_name, last_name)
    `,
      { count: "exact" },
    )
    .eq("student_id", studentId)
    .eq("school_id", schoolId)
    .order("date", { ascending: false });

  if (error) {
    return { success: false, data: [], total: 0, message: error.message };
  }

  return {
    success: true,
    data: (data || []) as unknown as DisciplinaryRecord[],
    total: count || 0,
  };
}
