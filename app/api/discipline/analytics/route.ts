export const dynamic = 'force-dynamic';

// app/api/discipline/analytics/route.ts
// ============================================================
// GET /api/discipline/analytics — Term/year discipline analytics with trends
// Supports filters: class_id, term_id, academic_year_id, student_id, severity
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
  severity: z.enum(["minor", "moderate", "major", "critical"]).optional(),
});

export const GET = withPermission("compliance", "view", async (request: NextRequest, { user }) => {
  const { searchParams } = new URL(request.url);

  const validation = validateQuery(searchParams, analyticsFiltersSchema);
  if (!validation.success) {
    return validationErrorResponse(validation.errors!);
  }

  const filters = validation.data!;
  const supabase = await createSupabaseServerClient();

  // Build base query
  let query = supabase
    .from("disciplinary_records")
    .select(
      `
      id,
      incident_type,
      severity,
      status,
      action_taken,
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
  if (filters.severity) {query = query.eq("severity", filters.severity);}

  const { data, error } = await query;
  if (error) {
    return errorResponse(error.message, 500);
  }

  const records = data || [];

  // Overall stats
  const totalIncidents = records.length;
  const bySeverity: Record<string, number> = { minor: 0, moderate: 0, major: 0, critical: 0 };
  const byStatus: Record<string, number> = { reported: 0, under_review: 0, resolved: 0, escalated: 0 };
  const byType: Record<string, number> = {};
  const majorIncidents = records.filter((r) => ["major", "critical"].includes(r.severity)).length;

  for (const r of records) {
    const sev = r.severity as string;
    if (bySeverity.hasOwnProperty(sev)) {bySeverity[sev]++;}

    const st = r.status as string;
    if (byStatus.hasOwnProperty(st)) {byStatus[st]++;}

    byType[r.incident_type] = (byType[r.incident_type] || 0) + 1;
  }

  // Group by term for trend
  const termMap = new Map<
    string,
    { termName: string; yearName: string; total: number; major: number; byType: Record<string, number> }
  >();

  for (const r of records) {
    const term = r.term as any;
    const academicYear = term?.academic_years;
    const termKey = `${academicYear?.name}-${term?.name}`;

    if (!termMap.has(termKey)) {
      termMap.set(termKey, {
        termName: term?.name || "Unknown",
        yearName: academicYear?.name || "Unknown",
        total: 0,
        major: 0,
        byType: {},
      });
    }

    const termData = termMap.get(termKey)!;
    termData.total++;
    if (["major", "critical"].includes(r.severity)) {termData.major++;}
    termData.byType[r.incident_type] = (termData.byType[r.incident_type] || 0) + 1;
  }

  const termStats = Array.from(termMap.entries())
    .map(([key, stats]) => ({
      term: key,
      termName: stats.termName,
      academicYear: stats.yearName,
      totalIncidents: stats.total,
      majorIncidents: stats.major,
      byType: stats.byType,
    }))
    .sort((a, b) => a.term.localeCompare(b.term));

  // Calculate trend
  let trend: "improving" | "stable" | "declining" | "insufficient_data" = "insufficient_data";
  if (termStats.length >= 2) {
    const first = termStats[0].totalIncidents;
    const last = termStats[termStats.length - 1].totalIncidents;
    const diff = last - first;
    if (diff < -2) {trend = "improving";}
    else if (diff > 2) {trend = "declining";}
    else {trend = "stable";}
  }

  // Group by class if no class filter
  let classStats: any[] = [];
  if (!filters.classId) {
    const classMap = new Map<string, { className: string; total: number; major: number }>();
    for (const r of records) {
      const cls = r.class as any;
      const classKey = cls?.id;
      if (!classMap.has(classKey)) {
        classMap.set(classKey, { className: cls?.name || "Unknown", total: 0, major: 0 });
      }
      const classData = classMap.get(classKey)!;
      classData.total++;
      if (["major", "critical"].includes(r.severity)) {classData.major++;}
    }
    classStats = Array.from(classMap.entries()).map(([key, stats]) => ({
      classId: key,
      className: stats.className,
      totalIncidents: stats.total,
      majorIncidents: stats.major,
    }));
  }

  return successResponse({
    overview: {
      totalIncidents,
      majorIncidents,
      bySeverity,
      byStatus,
      byType: Object.entries(byType)
        .map(([type, count]) => ({ type, count }))
        .sort((a, b) => b.count - a.count),
      trend,
    },
    byTerm: termStats,
    byClass: classStats,
  });
});
