// @ts-nocheck
// features/attendance/services/attendance.service.ts
// Attendance CRUD service with bulk operations

import { createClient } from "@/lib/supabase/client";
import type {
  AttendanceRecord,
  AttendanceFilters,
  BulkAttendanceEntry,
  AttendanceSummary,
  StudentAttendanceSummary,
  ClassAttendanceSummary,
  AttendanceStats,
  DailyAttendanceReport,
} from "../types";

const supabase = createClient();

// ============================================================
// SINGLE ATTENDANCE OPERATIONS
// ============================================================

export async function getAttendanceById(
  attendanceId: string,
  schoolId: string,
): Promise<{ success: boolean; data?: AttendanceRecord; message?: string }> {
  const { data, error } = await supabase
    .from("attendance")
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
    )
    .eq("id", attendanceId)
    .eq("school_id", schoolId)
    .single();

  if (error) {
    return { success: false, message: error.message };
  }

  return { success: true, data: data as unknown as AttendanceRecord };
}

export async function recordAttendance(entry: {
  student_id: string;
  class_id: string;
  date: string;
  status: "present" | "absent" | "late" | "excused";
  remarks?: string;
  recorded_by: string;
  school_id: string;
}): Promise<{ success: boolean; id?: string; message: string }> {
  // Check for duplicate
  const { data: existing } = await supabase
    .from("attendance")
    .select("id, status")
    .eq("student_id", entry.student_id)
    .eq("date", entry.date)
    .eq("school_id", entry.school_id)
    .maybeSingle();

  if (existing) {
    // Update existing record
    const { error } = await supabase
      .from("attendance")
      .update({
        status: entry.status,
        remarks: entry.remarks,
        recorded_by: entry.recorded_by,
        updated_at: new Date().toISOString(),
      })
      .eq("id", existing.id)
      .eq("school_id", entry.school_id);

    if (error) {
      return { success: false, message: error.message };
    }

    return { success: true, id: existing.id, message: "Attendance updated" };
  }

  // Insert new record
  const { data, error } = await supabase
    .from("attendance")
    .insert({
      student_id: entry.student_id,
      class_id: entry.class_id,
      date: entry.date,
      status: entry.status,
      remarks: entry.remarks || null,
      recorded_by: entry.recorded_by,
      school_id: entry.school_id,
    })
    .select("id")
    .single();

  if (error) {
    return { success: false, message: error.message };
  }

  return { success: true, id: data.id, message: "Attendance recorded" };
}

// ============================================================
// BULK ATTENDANCE OPERATIONS
// ============================================================

export async function recordBulkAttendance(
  entries: BulkAttendanceEntry,
  schoolId: string,
  recordedBy: string,
): Promise<{
  success: boolean;
  message: string;
  recorded: number;
  updated: number;
}> {
  let recorded = 0;
  let updated = 0;
  const errors: string[] = [];

  // Process each entry
  for (const entry of entries.entries) {
    // Check for existing record
    const { data: existing } = await supabase
      .from("attendance")
      .select("id")
      .eq("student_id", entry.student_id)
      .eq("date", entries.date)
      .eq("school_id", schoolId)
      .maybeSingle();

    if (existing) {
      const { error } = await supabase
        .from("attendance")
        .update({
          status: entry.status,
          remarks: entry.remarks || null,
          recorded_by: recordedBy,
          updated_at: new Date().toISOString(),
        })
        .eq("id", existing.id)
        .eq("school_id", schoolId);

      if (error) {
        errors.push(`Failed to update ${entry.student_id}: ${error.message}`);
      } else {
        updated++;
      }
    } else {
      const { error } = await supabase.from("attendance").insert({
        student_id: entry.student_id,
        class_id: entries.class_id,
        date: entries.date,
        status: entry.status,
        remarks: entry.remarks || null,
        recorded_by: recordedBy,
        school_id: schoolId,
      });

      if (error) {
        errors.push(`Failed to record ${entry.student_id}: ${error.message}`);
      } else {
        recorded++;
      }
    }
  }

  const totalProcessed = recorded + updated;
  const totalExpected = entries.entries.length;

  return {
    success: errors.length === 0,
    message:
      errors.length > 0
        ? `Processed ${totalProcessed}/${totalExpected}. Errors: ${errors.join("; ")}`
        : `Successfully processed ${totalProcessed} records (${recorded} new, ${updated} updated)`,
    recorded,
    updated,
  };
}

// ============================================================
// ATTENDANCE QUERIES
// ============================================================

export async function getAttendanceList(
  filters: AttendanceFilters,
  schoolId: string,
  page: number = 1,
  pageSize: number = 50,
): Promise<{
  success: boolean;
  data: AttendanceRecord[];
  total: number;
  message?: string;
}> {
  const offset = (page - 1) * pageSize;
  const safePage = Math.max(1, page);
  const safePageSize = Math.min(Math.max(1, pageSize), 200);
  const safeOffset = (safePage - 1) * safePageSize;

  let query = supabase
    .from("attendance")
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
  if (filters.class_id) {
    query = query.eq("class_id", filters.class_id);
  }
  if (filters.date) {
    query = query.eq("date", filters.date);
  }
  if (filters.date_from) {
    query = query.gte("date", filters.date_from);
  }
  if (filters.date_to) {
    query = query.lte("date", filters.date_to);
  }
  if (filters.status) {
    query = query.eq("status", filters.status);
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
    .range(safeOffset, safeOffset + safePageSize - 1);

  if (error) {
    return { success: false, data: [], total: 0, message: error.message };
  }

  return {
    success: true,
    data: (data || []) as unknown as AttendanceRecord[],
    total: count || 0,
  };
}

export async function getClassAttendanceForDate(
  classId: string,
  date: string,
  schoolId: string,
): Promise<{
  success: boolean;
  data: AttendanceRecord[];
  stats: AttendanceStats;
  message?: string;
}> {
  // Get all students in the class
  const { data: students, error: studentsError } = await supabase
    .from("student_classes")
    .select(
      `
      student_id,
      student:students(
        student_id,
        admission_no,
        user:users(first_name, last_name)
      )
    `,
    )
    .eq("class_id", classId)
    .eq("school_id", schoolId)
    .eq("status", "active");

  if (studentsError) {
    return {
      success: false,
      data: [],
      stats: {
        total: 0,
        present: 0,
        absent: 0,
        late: 0,
        excused: 0,
        attendance_rate: 0,
      },
      message: studentsError.message,
    };
  }

  // Get attendance records for this date
  const { data: records, error: recordsError } = await supabase
    .from("attendance")
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
    )
    .eq("class_id", classId)
    .eq("date", date)
    .eq("school_id", schoolId);

  if (recordsError) {
    return {
      success: false,
      data: [],
      stats: {
        total: 0,
        present: 0,
        absent: 0,
        late: 0,
        excused: 0,
        attendance_rate: 0,
      },
      message: recordsError.message,
    };
  }

  const total = students?.length || 0;
  const present = records?.filter((r) => r.status === "present").length || 0;
  const late = records?.filter((r) => r.status === "late").length || 0;
  const absent = records?.filter((r) => r.status === "absent").length || 0;
  const excused = records?.filter((r) => r.status === "excused").length || 0;

  const stats: AttendanceStats = {
    total,
    present,
    absent,
    late,
    excused,
    attendance_rate:
      total > 0 ? Math.round(((present + late) / total) * 100 * 10) / 10 : 0,
  };

  return {
    success: true,
    data: (records || []) as unknown as AttendanceRecord[],
    stats,
  };
}

// ============================================================
// ATTENDANCE SUMMARIES
// ============================================================

export async function getStudentAttendanceSummary(
  studentId: string,
  schoolId: string,
  term?: string,
  academicYear?: string,
): Promise<{
  success: boolean;
  data?: StudentAttendanceSummary;
  message?: string;
}> {
  let query = supabase
    .from("attendance")
    .select("*")
    .eq("student_id", studentId)
    .eq("school_id", schoolId);

  if (term) {
    query = query.eq("term", term);
  }
  if (academicYear) {
    query = query.eq("academic_year", academicYear);
  }

  const { data, error } = await query.order("date", { ascending: true });

  if (error) {
    return { success: false, message: error.message };
  }

  const records = data || [];
  const totalDays = records.length;
  const presentDays = records.filter((r) => r.status === "present").length;
  const absentDays = records.filter((r) => r.status === "absent").length;
  const lateDays = records.filter((r) => r.status === "late").length;
  const excusedDays = records.filter((r) => r.status === "excused").length;

  // Calculate monthly breakdown
  const monthlyMap = new Map<
    string,
    {
      present: number;
      absent: number;
      late: number;
      excused: number;
      total: number;
    }
  >();

  records.forEach((record) => {
    const month = record.date.substring(0, 7); // YYYY-MM
    if (!monthlyMap.has(month)) {
      monthlyMap.set(month, {
        present: 0,
        absent: 0,
        late: 0,
        excused: 0,
        total: 0,
      });
    }
    const m = monthlyMap.get(month)!;
    m.total++;
    m[record.status as "present" | "absent" | "late" | "excused"]++;
  });

  const monthlyBreakdown = Array.from(monthlyMap.entries()).map(
    ([month, stats]) => ({
      month,
      ...stats,
      attendance_rate:
        stats.total > 0
          ? Math.round(
              ((stats.present + stats.late) / stats.total) * 100 * 10,
            ) / 10
          : 0,
    }),
  );

  // Identify consecutive absences
  const consecutiveAbsences: {
    start_date: string;
    end_date: string;
    days: number;
  }[] = [];
  let streakStart: string | null = null;
  let streakDays = 0;

  records.forEach((record, index) => {
    if (record.status === "absent") {
      if (!streakStart) {
        streakStart = record.date;
        streakDays = 1;
      } else {
        streakDays++;
      }
    } else {
      if (streakStart && streakDays >= 3) {
        consecutiveAbsences.push({
          start_date: streakStart,
          end_date: records[index - 1].date,
          days: streakDays,
        });
      }
      streakStart = null;
      streakDays = 0;
    }
  });

  // Handle streak at end
  if (streakStart && streakDays >= 3) {
    consecutiveAbsences.push({
      start_date: streakStart,
      end_date: records[records.length - 1].date,
      days: streakDays,
    });
  }

  const summary: StudentAttendanceSummary = {
    student_id: studentId,
    total_days: totalDays,
    present_days: presentDays,
    absent_days: absentDays,
    late_days: lateDays,
    excused_days: excusedDays,
    attendance_rate:
      totalDays > 0
        ? Math.round(((presentDays + lateDays) / totalDays) * 100 * 10) / 10
        : 0,
    monthly_breakdown: monthlyBreakdown,
    consecutive_absences: consecutiveAbsences,
  };

  return { success: true, data: summary };
}

export async function getClassAttendanceSummary(
  classId: string,
  schoolId: string,
  dateFrom: string,
  dateTo: string,
): Promise<{
  success: boolean;
  data?: ClassAttendanceSummary;
  message?: string;
}> {
  const { data: records, error } = await supabase
    .from("attendance")
    .select("*")
    .eq("class_id", classId)
    .eq("school_id", schoolId)
    .gte("date", dateFrom)
    .lte("date", dateTo);

  if (error) {
    return { success: false, message: error.message };
  }

  const allRecords = records || [];

  // Get unique students
  const studentIds = [...new Set(allRecords.map((r) => r.student_id))];

  // Get unique dates
  const dates = [...new Set(allRecords.map((r) => r.date))].sort();

  // Calculate per-student summaries
  const studentSummaries = studentIds.map((sid) => {
    const studentRecords = allRecords.filter((r) => r.student_id === sid);
    const total = studentRecords.length;
    const present = studentRecords.filter((r) => r.status === "present").length;
    const late = studentRecords.filter((r) => r.status === "late").length;
    const absent = studentRecords.filter((r) => r.status === "absent").length;

    return {
      student_id: sid,
      total_days: total,
      present_days: present,
      absent_days: absent,
      late_days: late,
      attendance_rate:
        total > 0 ? Math.round(((present + late) / total) * 100 * 10) / 10 : 0,
    };
  });

  // Daily breakdown
  const dailyBreakdown: DailyAttendanceReport[] = dates.map((date) => {
    const dayRecords = allRecords.filter((r) => r.date === date);
    const total = dayRecords.length;
    const present = dayRecords.filter((r) => r.status === "present").length;
    const late = dayRecords.filter((r) => r.status === "late").length;
    const absent = dayRecords.filter((r) => r.status === "absent").length;
    const excused = dayRecords.filter((r) => r.status === "excused").length;

    return {
      date,
      total_students: total,
      present,
      absent,
      late,
      excused,
      attendance_rate:
        total > 0 ? Math.round(((present + late) / total) * 100 * 10) / 10 : 0,
    };
  });

  // Overall stats
  const totalRecords = allRecords.length;
  const totalPresent = allRecords.filter((r) => r.status === "present").length;
  const totalLate = allRecords.filter((r) => r.status === "late").length;
  const totalAbsent = allRecords.filter((r) => r.status === "absent").length;
  const totalExcused = allRecords.filter((r) => r.status === "excused").length;

  // Students below 80% attendance
  const atRiskStudents = studentSummaries
    .filter((s) => s.attendance_rate < 80)
    .sort((a, b) => a.attendance_rate - b.attendance_rate);

  const summary: ClassAttendanceSummary = {
    class_id: classId,
    date_from: dateFrom,
    date_to: dateTo,
    total_students: studentIds.length,
    school_days: dates.length,
    overall_stats: {
      total: totalRecords,
      present: totalPresent,
      absent: totalAbsent,
      late: totalLate,
      excused: totalExcused,
      attendance_rate:
        totalRecords > 0
          ? Math.round(((totalPresent + totalLate) / totalRecords) * 100 * 10) /
            10
          : 0,
    },
    daily_breakdown: dailyBreakdown,
    student_summaries: studentSummaries,
    at_risk_students: atRiskStudents,
  };

  return { success: true, data: summary };
}

export async function getDailySchoolAttendance(
  schoolId: string,
  date: string,
): Promise<{
  success: boolean;
  data?: {
    date: string;
    classes: Array<{
      class_id: string;
      class_name: string;
      stats: AttendanceStats;
      recorded: boolean;
    }>;
    school_stats: AttendanceStats;
  };
  message?: string;
}> {
  // Get all active classes
  const { data: classes, error: classError } = await supabase
    .from("classes")
    .select("class_id, name")
    .eq("school_id", schoolId)
    .eq("status", "active")
    .order("name");

  if (classError) {
    return { success: false, message: classError.message };
  }

  // Get all attendance for the date
  const { data: records, error: attendanceError } = await supabase
    .from("attendance")
    .select("*")
    .eq("school_id", schoolId)
    .eq("date", date);

  if (attendanceError) {
    return { success: false, message: attendanceError.message };
  }

  const allRecords = records || [];

  // Calculate per-class stats
  const classStats = (classes || []).map((cls) => {
    const classRecords = allRecords.filter((r) => r.class_id === cls.class_id);
    const total = classRecords.length;
    const present = classRecords.filter((r) => r.status === "present").length;
    const late = classRecords.filter((r) => r.status === "late").length;
    const absent = classRecords.filter((r) => r.status === "absent").length;
    const excused = classRecords.filter((r) => r.status === "excused").length;

    return {
      class_id: cls.class_id,
      class_name: cls.name,
      recorded: total > 0,
      stats: {
        total,
        present,
        absent,
        late,
        excused,
        attendance_rate:
          total > 0
            ? Math.round(((present + late) / total) * 100 * 10) / 10
            : 0,
      },
    };
  });

  // School-wide stats
  const totalRecords = allRecords.length;
  const schoolStats: AttendanceStats = {
    total: totalRecords,
    present: allRecords.filter((r) => r.status === "present").length,
    absent: allRecords.filter((r) => r.status === "absent").length,
    late: allRecords.filter((r) => r.status === "late").length,
    excused: allRecords.filter((r) => r.status === "excused").length,
    attendance_rate:
      totalRecords > 0
        ? Math.round(
            ((allRecords.filter((r) => r.status === "present").length +
              allRecords.filter((r) => r.status === "late").length) /
              totalRecords) *
              100 *
              10,
          ) / 10
        : 0,
  };

  return {
    success: true,
    data: {
      date,
      classes: classStats,
      school_stats: schoolStats,
    },
  };
}

// ============================================================
// ATTENDANCE DELETION
// ============================================================

export async function deleteAttendanceRecord(
  attendanceId: string,
  schoolId: string,
): Promise<{ success: boolean; message: string }> {
  const { error } = await supabase
    .from("attendance")
    .delete()
    .eq("id", attendanceId)
    .eq("school_id", schoolId);

  if (error) {
    return { success: false, message: error.message };
  }

  return { success: true, message: "Attendance record deleted" };
}
