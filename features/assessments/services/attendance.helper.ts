// features/assessments/services/attendance.helper.ts
// ============================================================
// Helper to fetch attendance summary for report cards
// Separated to avoid circular dependencies
// ============================================================

import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { AuthUser } from "@/types/auth";
import type { AttendanceSummary } from "../types";

// ============================================================
// GET STUDENT ATTENDANCE SUMMARY FOR A TERM
// ============================================================
export async function getStudentAttendanceSummary(
  studentId: string,
  termId: string,
  currentUser: AuthUser,
): Promise<AttendanceSummary> {
  const supabase = await createSupabaseServerClient();

  let query = supabase
    .from("attendance")
    .select("status")
    .eq("student_id", studentId)
    .eq("term_id", termId);

  if (currentUser.role !== "super_admin") {
    query = query.eq("school_id", currentUser.schoolId!);
  }

  const { data, error } = await query;

  if (error || !data || data.length === 0) {
    return {
      totalDays: 0,
      presentDays: 0,
      absentDays: 0,
      lateDays: 0,
      attendancePercentage: 0,
    };
  }

  const totalDays = data.length;
  const presentDays = data.filter((r: any) => r.status === "present").length;
  const absentDays = data.filter((r: any) => r.status === "absent").length;
  const lateDays = data.filter((r: any) => r.status === "late").length;
  const excusedDays = data.filter((r: any) => r.status === "excused").length;

  // Count present + late + excused as "attended"
  const attendedDays = presentDays + lateDays + excusedDays;
  const attendancePercentage =
    totalDays > 0
      ? Math.round((attendedDays / totalDays) * 100 * 100) / 100
      : 0;

  return {
    totalDays,
    presentDays,
    absentDays,
    lateDays,
    attendancePercentage,
  };
}
