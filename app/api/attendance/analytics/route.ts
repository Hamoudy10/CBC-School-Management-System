export const dynamic = 'force-dynamic';

// app/api/attendance/analytics/route.ts
// ============================================================
// GET /api/attendance/analytics — Term/year attendance analytics with trends
// Supports filters: class_id, term_id, academic_year_id, student_id
// ============================================================

import { NextRequest } from "next/server";
import { z } from "zod";
import { withPermission } from "@/lib/api/withAuth";
import { validateQuery } from "@/lib/api/validation";
import {
  successResponse,
  errorResponse,
  validationErrorResponse,
} from "@/lib/api/response";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const analyticsFiltersSchema = z.object({
  classId: z.string().uuid().optional(),
  termId: z.string().uuid().optional(),
  academicYearId: z.string().uuid().optional(),
  studentId: z.string().uuid().optional(),
});

export const GET = withPermission("attendance", "view", async (request: NextRequest, { user }) => {
  const { searchParams } = new URL(request.url);

  const validation = validateQuery(searchParams, analyticsFiltersSchema);
  if (!validation.success) {
    return validationErrorResponse(validation.errors!);
  }

  const filters = validation.data!;
  const supabase = await createSupabaseServerClient();

  // Build base query
  let query = supabase
    .from("attendance")
    .select(
      `
      status,
      date,
      student:students!inner(
        id,
        first_name,
        last_name,
        current_class_id
      ),
      class:classes!inner(id, name),
      term:terms!inner(id, name, academic_years!inner(id, name))
    `,
    )
    .eq("student.school_id", user.school_id);

  if (filters.classId) {query = query.eq("class.id", filters.classId);}
  if (filters.termId) {query = query.eq("term.id", filters.termId);}
  if (filters.academicYearId) {query = query.eq("term.academic_years.id", filters.academicYearId);}
  if (filters.studentId) {query = query.eq("student.id", filters.studentId);}

  const { data, error } = await query;
  if (error) {
    return errorResponse(error.message, 500);
  }

  const records = data || [];

  // Calculate overall stats
  const totalRecords = records.length;
  const present = records.filter((r) => r.status === "present").length;
  const absent = records.filter((r) => r.status === "absent").length;
  const late = records.filter((r) => r.status === "late").length;

  const attendanceRate =
    totalRecords > 0
      ? Math.round(((present + late) / totalRecords) * 1000) / 10
      : 0;

  // Group by term for trend analysis
  const termMap = new Map<
    string,
    { termName: string; yearName: string; present: number; absent: number; late: number; total: number }
  >();

  for (const r of records) {
    const term = r.term as any;
    const academicYear = term?.academic_years;
    const termKey = `${academicYear?.name}-${term?.name}`;

    if (!termMap.has(termKey)) {
      termMap.set(termKey, {
        termName: term?.name || "Unknown",
        yearName: academicYear?.name || "Unknown",
        present: 0,
        absent: 0,
        late: 0,
        total: 0,
      });
    }

    const termData = termMap.get(termKey)!;
    termData.total++;
    if (r.status === "present") {termData.present++;}
    else if (r.status === "absent") {termData.absent++;}
    else if (r.status === "late") {termData.late++;}
  }

  // Calculate per-term rates and trends
  const termStats = Array.from(termMap.entries())
    .map(([key, stats]) => ({
      term: key,
      termName: stats.termName,
      academicYear: stats.yearName,
      totalDays: stats.total,
      present: stats.present,
      absent: stats.absent,
      late: stats.late,
      attendanceRate:
        stats.total > 0
          ? Math.round(((stats.present + stats.late) / stats.total) * 1000) / 10
          : 0,
    }))
    .sort((a, b) => a.term.localeCompare(b.term));

  // Calculate trend
  let trend: "improving" | "stable" | "declining" | "insufficient_data" = "insufficient_data";
  if (termStats.length >= 2) {
    const first = termStats[0].attendanceRate;
    const last = termStats[termStats.length - 1].attendanceRate;
    const diff = last - first;
    if (diff > 3) {trend = "improving";}
    else if (diff < -3) {trend = "declining";}
    else {trend = "stable";}
  }

  // Group by class if no class filter
  let classStats: any[] = [];
  if (!filters.classId) {
    const classMap = new Map<string, { className: string; present: number; absent: number; late: number; total: number }>();
    for (const r of records) {
      const cls = r.class as any;
      const classKey = cls?.id;
      if (!classMap.has(classKey)) {
        classMap.set(classKey, {
          className: cls?.name || "Unknown",
          present: 0,
          absent: 0,
          late: 0,
          total: 0,
        });
      }
      const classData = classMap.get(classKey)!;
      classData.total++;
      if (r.status === "present") {classData.present++;}
      else if (r.status === "absent") {classData.absent++;}
      else if (r.status === "late") {classData.late++;}
    }
    classStats = Array.from(classMap.entries()).map(([key, stats]) => ({
      classId: key,
      className: stats.className,
      totalDays: stats.total,
      present: stats.present,
      absent: stats.absent,
      late: stats.late,
      attendanceRate:
        stats.total > 0
          ? Math.round(((stats.present + stats.late) / stats.total) * 1000) / 10
          : 0,
    }));
  }

  return successResponse({
    overview: {
      totalRecords,
      present,
      absent,
      late,
      attendanceRate,
      trend,
    },
    byTerm: termStats,
    byClass: classStats,
  });
});
