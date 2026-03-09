// @ts-nocheck
// features/attendance/services/discipline.service.ts
// Disciplinary records CRUD + analytics

import { createServerClient } from "@/lib/supabase/server";
import type {
  DisciplinaryRecord,
  DisciplineFilters,
  DisciplineSummary,
  IncidentSeverity,
  IncidentStatus,
} from "../types";

export class DisciplineService {
  // ── Create disciplinary record ──
  static async createRecord(
    schoolId: string,
    data: {
      student_id: string;
      incident_type: string;
      severity: IncidentSeverity;
      description: string;
      date: string;
      location?: string;
      witnesses?: string;
      action_taken: string;
      action_details?: string;
      parent_notified: boolean;
      parent_notified_date?: string;
      follow_up_date?: string;
    },
    recordedBy: string,
  ): Promise<{ success: boolean; message: string; id?: string }> {
    const supabase = await createServerClient();

    // Verify student belongs to school
    const { data: student } = await supabase
      .from("students")
      .select("id")
      .eq("id", data.student_id)
      .eq("school_id", schoolId)
      .maybeSingle();

    if (!student)
      return { success: false, message: "Student not found in this school" };

    const { data: record, error } = await supabase
      .from("disciplinary_records")
      .insert({
        student_id: data.student_id,
        school_id: schoolId,
        incident_type: data.incident_type,
        severity: data.severity,
        description: data.description,
        date: data.date,
        location: data.location || null,
        witnesses: data.witnesses || null,
        action_taken: data.action_taken,
        action_details: data.action_details || null,
        status: "reported",
        parent_notified: data.parent_notified,
        parent_notified_date: data.parent_notified_date || null,
        follow_up_date: data.follow_up_date || null,
        recorded_by: recordedBy,
      })
      .select("id")
      .single();

    if (error) return { success: false, message: error.message };
    return {
      success: true,
      message: "Disciplinary record created",
      id: record.id,
    };
  }

  // ── Update disciplinary record ──
  static async updateRecord(
    schoolId: string,
    recordId: string,
    data: Partial<{
      incident_type: string;
      severity: IncidentSeverity;
      description: string;
      action_taken: string;
      action_details: string;
      status: IncidentStatus;
      parent_notified: boolean;
      parent_notified_date: string;
      follow_up_date: string;
      follow_up_notes: string;
    }>,
    updatedBy: string,
  ): Promise<{ success: boolean; message: string }> {
    const supabase = await createServerClient();

    // Verify record exists
    const { data: existing } = await supabase
      .from("disciplinary_records")
      .select("id, status")
      .eq("id", recordId)
      .eq("school_id", schoolId)
      .maybeSingle();

    if (!existing) return { success: false, message: "Record not found" };

    const updateData: any = {
      ...data,
      updated_at: new Date().toISOString(),
    };

    // If resolving, set resolver
    if (data.status === "resolved") {
      updateData.resolved_by = updatedBy;
      updateData.resolved_at = new Date().toISOString();
    }

    const { error } = await supabase
      .from("disciplinary_records")
      .update(updateData)
      .eq("id", recordId)
      .eq("school_id", schoolId);

    if (error) return { success: false, message: error.message };
    return { success: true, message: "Disciplinary record updated" };
  }

  // ── Get records with filters ──
  static async getRecords(
    schoolId: string,
    filters: DisciplineFilters,
  ): Promise<{ data: DisciplinaryRecord[]; total: number }> {
    const supabase = await createServerClient();
    const page = filters.page || 1;
    const pageSize = filters.page_size || 20;
    const offset = (page - 1) * pageSize;

    let query = supabase
      .from("disciplinary_records")
      .select(
        `
        *,
        student:students!inner(id, admission_no, first_name, last_name, current_class_id),
        recorder:users!disciplinary_records_recorded_by_fkey(first_name, last_name),
        resolver:users!disciplinary_records_resolved_by_fkey(first_name, last_name)
      `,
        { count: "exact" },
      )
      .eq("school_id", schoolId)
      .order("date", { ascending: false })
      .range(offset, offset + pageSize - 1);

    if (filters.student_id) query = query.eq("student_id", filters.student_id);
    if (filters.severity) query = query.eq("severity", filters.severity);
    if (filters.status) query = query.eq("status", filters.status);
    if (filters.incident_type)
      query = query.eq("incident_type", filters.incident_type);
    if (filters.date_from) query = query.gte("date", filters.date_from);
    if (filters.date_to) query = query.lte("date", filters.date_to);
    if (filters.class_id)
      query = query.eq("student.current_class_id", filters.class_id);

    const { data, count, error } = await query;
    if (error) throw new Error(error.message);

    return { data: (data || []) as DisciplinaryRecord[], total: count || 0 };
  }

  // ── Get single record ──
  static async getRecord(
    schoolId: string,
    recordId: string,
  ): Promise<DisciplinaryRecord | null> {
    const supabase = await createServerClient();

    const { data, error } = await supabase
      .from("disciplinary_records")
      .select(
        `
        *,
        student:students!inner(id, admission_no, first_name, last_name, current_class_id),
        recorder:users!disciplinary_records_recorded_by_fkey(first_name, last_name),
        resolver:users!disciplinary_records_resolved_by_fkey(first_name, last_name)
      `,
      )
      .eq("id", recordId)
      .eq("school_id", schoolId)
      .maybeSingle();

    if (error) throw new Error(error.message);
    return data as DisciplinaryRecord | null;
  }

  // ── Get student discipline history ──
  static async getStudentHistory(
    schoolId: string,
    studentId: string,
  ): Promise<DisciplinaryRecord[]> {
    const supabase = await createServerClient();

    const { data, error } = await supabase
      .from("disciplinary_records")
      .select(
        `
        *,
        recorder:users!disciplinary_records_recorded_by_fkey(first_name, last_name),
        resolver:users!disciplinary_records_resolved_by_fkey(first_name, last_name)
      `,
      )
      .eq("school_id", schoolId)
      .eq("student_id", studentId)
      .order("date", { ascending: false });

    if (error) throw new Error(error.message);
    return (data || []) as DisciplinaryRecord[];
  }

  // ── Discipline summary / analytics ──
  static async getSummary(
    schoolId: string,
    dateFrom?: string,
    dateTo?: string,
    classId?: string,
  ): Promise<DisciplineSummary> {
    const supabase = await createServerClient();

    let query = supabase
      .from("disciplinary_records")
      .select(
        `
        id, severity, status, incident_type, date,
        student:students!inner(id, first_name, last_name, admission_no, current_class_id)
      `,
      )
      .eq("school_id", schoolId);

    if (dateFrom) query = query.gte("date", dateFrom);
    if (dateTo) query = query.lte("date", dateTo);
    if (classId) query = query.eq("student.current_class_id", classId);

    const { data, error } = await query;
    if (error) throw new Error(error.message);

    const records = data || [];

    // By severity
    const bySeverity: Record<IncidentSeverity, number> = {
      minor: 0,
      moderate: 0,
      major: 0,
      critical: 0,
    };
    const byStatus: Record<IncidentStatus, number> = {
      reported: 0,
      under_review: 0,
      resolved: 0,
      escalated: 0,
    };
    const typeCount = new Map<string, number>();
    const monthCount = new Map<string, number>();
    const studentCount = new Map<
      string,
      { name: string; admission_no: string; count: number }
    >();

    for (const r of records) {
      bySeverity[r.severity as IncidentSeverity]++;
      byStatus[r.status as IncidentStatus]++;

      // By type
      typeCount.set(r.incident_type, (typeCount.get(r.incident_type) || 0) + 1);

      // By month
      const month = r.date.substring(0, 7); // YYYY-MM
      monthCount.set(month, (monthCount.get(month) || 0) + 1);

      // Repeat offenders
      const student = r.student as any;
      if (student) {
        const existing = studentCount.get(student.id);
        if (existing) {
          existing.count++;
        } else {
          studentCount.set(student.id, {
            name: `${student.first_name} ${student.last_name}`,
            admission_no: student.admission_no,
            count: 1,
          });
        }
      }
    }

    const byType = Array.from(typeCount.entries())
      .map(([type, count]) => ({ type, count }))
      .sort((a, b) => b.count - a.count);

    const byMonth = Array.from(monthCount.entries())
      .map(([month, count]) => ({ month, count }))
      .sort((a, b) => a.month.localeCompare(b.month));

    const repeatOffenders = Array.from(studentCount.entries())
      .filter(([_, info]) => info.count > 1)
      .map(([studentId, info]) => ({
        student_id: studentId,
        student_name: info.name,
        admission_no: info.admission_no,
        incident_count: info.count,
      }))
      .sort((a, b) => b.incident_count - a.incident_count);

    return {
      total_incidents: records.length,
      by_severity: bySeverity,
      by_status: byStatus,
      by_type: byType,
      by_month: byMonth,
      repeat_offenders: repeatOffenders,
    };
  }

  // ── Delete record (admin only) ──
  static async deleteRecord(
    schoolId: string,
    recordId: string,
  ): Promise<{ success: boolean; message: string }> {
    const supabase = await createServerClient();

    const { error } = await supabase
      .from("disciplinary_records")
      .delete()
      .eq("id", recordId)
      .eq("school_id", schoolId);

    if (error) return { success: false, message: error.message };
    return { success: true, message: "Disciplinary record deleted" };
  }
}
