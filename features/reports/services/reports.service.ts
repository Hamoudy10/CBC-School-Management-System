// features/reports/services/reports.service.ts
// Report generation orchestration service

import { createClient } from "@/lib/supabase/client";
import {
  assembleReportCardData,
  assembleClassReportData,
} from "./reportCard.generator";
import {
  generateReportCardHTML,
  generateFinanceReportHTML,
} from "./pdf.service";
import type { ReportRequest, ReportType } from "../types";

const supabase = createClient();

// ============================================================
// REPORT REQUEST MANAGEMENT
// ============================================================

export async function createReportRequest(
  reportType: ReportType,
  parameters: Record<string, unknown>,
  requestedBy: string,
  schoolId: string,
  format: "pdf" | "csv" | "json" = "pdf",
): Promise<{ success: boolean; id?: string; message: string }> {
  const { data, error } = await supabase
    .from("report_requests")
    .insert({
      report_type: reportType,
      format,
      status: "pending",
      parameters,
      requested_by: requestedBy,
      school_id: schoolId,
    })
    .select("id")
    .single();

  if (error) {
    return { success: false, message: error.message };
  }

  return { success: true, id: data.id, message: "Report request created" };
}

export async function getReportRequest(
  requestId: string,
  schoolId: string,
): Promise<{ success: boolean; data?: ReportRequest; message?: string }> {
  const { data, error } = await supabase
    .from("report_requests")
    .select("*")
    .eq("id", requestId)
    .eq("school_id", schoolId)
    .single();

  if (error) {
    return { success: false, message: error.message };
  }

  return { success: true, data: data as ReportRequest };
}

export async function getReportRequests(
  schoolId: string,
  filters?: {
    report_type?: ReportType;
    status?: string;
    requested_by?: string;
  },
  page: number = 1,
  pageSize: number = 20,
): Promise<{
  success: boolean;
  data: ReportRequest[];
  total: number;
  message?: string;
}> {
  const offset = (page - 1) * pageSize;

  let query = supabase
    .from("report_requests")
    .select("*", { count: "exact" })
    .eq("school_id", schoolId);

  if (filters?.report_type)
    query = query.eq("report_type", filters.report_type);
  if (filters?.status) query = query.eq("status", filters.status);
  if (filters?.requested_by)
    query = query.eq("requested_by", filters.requested_by);

  const { data, error, count } = await query
    .order("created_at", { ascending: false })
    .range(offset, offset + pageSize - 1);

  if (error) {
    return { success: false, data: [], total: 0, message: error.message };
  }

  return {
    success: true,
    data: (data || []) as ReportRequest[],
    total: count || 0,
  };
}

// ============================================================
// REPORT GENERATION
// ============================================================

export async function generateStudentReportCard(
  studentId: string,
  term: string,
  academicYear: string,
  schoolId: string,
  requestedBy: string,
): Promise<{ success: boolean; html?: string; data?: any; message: string }> {
  // Update status to generating
  const reportResult = await assembleReportCardData(
    studentId,
    term,
    academicYear,
    schoolId,
  );

  if (!reportResult.success || !reportResult.data) {
    return {
      success: false,
      message: reportResult.message || "Failed to assemble report data",
    };
  }

  // Generate HTML
  const html = generateReportCardHTML(reportResult.data);

  // Store report card record
  const { data: existingReport } = await supabase
    .from("report_cards")
    .select("report_id")
    .eq("student_id", studentId)
    .eq("term", term)
    .eq("academic_year", academicYear)
    .eq("school_id", schoolId)
    .maybeSingle();

  const analyticsJson = {
    overall: reportResult.data.overall,
    attendance: reportResult.data.attendance,
    learning_area_count: reportResult.data.learning_areas.length,
    generated_at: new Date().toISOString(),
  };

  if (existingReport) {
    await supabase
      .from("report_cards")
      .update({
        analytics_json: analyticsJson,
        generated_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("report_id", existingReport.report_id);
  } else {
    await supabase.from("report_cards").insert({
      student_id: studentId,
      term,
      academic_year: academicYear,
      analytics_json: analyticsJson,
      generated_at: new Date().toISOString(),
      school_id: schoolId,
    });
  }

  return {
    success: true,
    html,
    data: reportResult.data,
    message: "Report card generated successfully",
  };
}

export async function generateClassReport(
  classId: string,
  term: string,
  academicYear: string,
  schoolId: string,
): Promise<{ success: boolean; data?: any; message: string }> {
  const result = await assembleClassReportData(
    classId,
    term,
    academicYear,
    schoolId,
  );

  if (!result.success) {
    return {
      success: false,
      message: result.message || "Failed to generate class report",
    };
  }

  return {
    success: true,
    data: result.data,
    message: "Class report generated",
  };
}

// ============================================================
// BATCH REPORT GENERATION
// ============================================================

export async function generateClassReportCards(
  classId: string,
  term: string,
  academicYear: string,
  schoolId: string,
  requestedBy: string,
): Promise<{
  success: boolean;
  generated: number;
  failed: number;
  errors: string[];
  message: string;
}> {
  // Get all students in class
  const { data: students, error: studentsErr } = await supabase
    .from("student_classes")
    .select("student_id")
    .eq("class_id", classId)
    .eq("school_id", schoolId)
    .eq("status", "active");

  if (studentsErr || !students) {
    return {
      success: false,
      generated: 0,
      failed: 0,
      errors: [studentsErr?.message || "No students found"],
      message: "Failed to fetch students",
    };
  }

  let generated = 0;
  let failed = 0;
  const errors: string[] = [];

  for (const student of students) {
    const result = await generateStudentReportCard(
      student.student_id,
      term,
      academicYear,
      schoolId,
      requestedBy,
    );

    if (result.success) {
      generated++;
    } else {
      failed++;
      errors.push(`Student ${student.student_id}: ${result.message}`);
    }
  }

  return {
    success: errors.length === 0,
    generated,
    failed,
    errors,
    message: `Generated ${generated}/${students.length} report cards. ${failed} failed.`,
  };
}
