// features/assessments/services/reportCards.service.ts
// ============================================================
// Report Card Generation service
// Creates term-wise and yearly report cards
// Assembles analytics JSON for charting
// Handles publishing and PDF URL management
// ============================================================

import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { AuthUser } from "@/types/auth";
import type {
  ReportCard,
  ReportAnalytics,
  PerformanceLevelLabel,
} from "../types";
import type {
  GenerateReportCardInput,
  PublishReportCardsInput,
  UpdateReportCardRemarksInput,
  ReportCardFiltersInput,
} from "../validators/assessment.schema";
import type { PaginatedResponse } from "@/features/users/types";
import {
  calculateAllLearningAreaSummaries,
  calculateYearlySummary,
  calculateOverallStudentPerformance,
} from "./aggregation.service";
import { calculateStudentTrends } from "./analytics.service";
import { getStudentAttendanceSummary } from "./attendance.helper";

function firstRelation<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return value ?? null;
}

// ============================================================
// LIST REPORT CARDS
// ============================================================
export async function listReportCards(
  filters: ReportCardFiltersInput,
  currentUser: AuthUser,
): Promise<PaginatedResponse<ReportCard>> {
  const supabase = await createSupabaseServerClient();
  const { page, pageSize } = filters;
  const offset = (page - 1) * pageSize;

  let query = supabase.from("report_cards").select(
    `
      *,
      students (
        first_name,
        last_name,
        admission_number
      ),
      classes (
        name
      ),
      academic_years (
        year
      ),
      terms (
        name
      )
    `,
    { count: "exact" },
  );

  if (currentUser.role !== "super_admin") {
    query = query.eq("school_id", currentUser.schoolId!);
  }

  if (currentUser.role === "parent") {
    const { data: guardianLinks } = await supabase
      .from("student_guardians")
      .select("student_id")
      .eq("guardian_user_id", currentUser.id);

    const childIds = (guardianLinks ?? []).map((link: any) => link.student_id);
    query = query.in("student_id", childIds.length > 0 ? childIds : ["__none__"]);
  }

  if (currentUser.role === "student") {
    const { data: studentRecord } = await supabase
      .from("students")
      .select("student_id")
      .eq("user_id", currentUser.id)
      .maybeSingle();

    query = query.eq("student_id", studentRecord?.student_id ?? "__none__");
  }

  // Apply filters
  if (filters.studentId) {
    query = query.eq("student_id", filters.studentId);
  }
  if (filters.classId) {
    query = query.eq("class_id", filters.classId);
  }
  if (filters.academicYearId) {
    query = query.eq("academic_year_id", filters.academicYearId);
  }
  if (filters.termId) {
    query = query.eq("term_id", filters.termId);
  }
  if (filters.reportType) {
    query = query.eq("report_type", filters.reportType);
  }
  if (filters.isPublished !== undefined) {
    query = query.eq("is_published", filters.isPublished);
  }

  query = query
    .order("generated_at", { ascending: false })
    .range(offset, offset + pageSize - 1);

  const { data, error, count } = await query;

  if (error) {
    throw new Error(`Failed to list report cards: ${error.message}`);
  }

  const items: ReportCard[] = (data || []).map((row: any) => {
    const student = firstRelation(row.students);
    const classRecord = firstRelation(row.classes);
    const academicYear = firstRelation(row.academic_years);
    const term = firstRelation(row.terms);

    return {
      reportId: row.report_id,
      schoolId: row.school_id,
      studentId: row.student_id,
      studentName: student
        ? `${student.first_name} ${student.last_name}`.trim()
        : undefined,
      studentAdmissionNo: student?.admission_number || undefined,
      classId: row.class_id,
      className: classRecord?.name || undefined,
      academicYearId: row.academic_year_id,
      academicYear: academicYear?.year || undefined,
      termId: row.term_id,
      termName: term?.name || undefined,
      reportType: row.report_type,
      overallAverage: row.overall_average
        ? parseFloat(row.overall_average)
        : null,
      overallLevel: row.overall_level as PerformanceLevelLabel | null,
      classTeacherRemarks: row.class_teacher_remarks,
      principalRemarks: row.principal_remarks,
      analyticsJson: row.analytics_json,
      pdfUrl: row.pdf_url,
      isPublished: row.is_published,
      publishedAt: row.published_at,
      generatedAt: row.generated_at,
      generatedBy: row.generated_by,
    };
  });

  const total = count || 0;

  return {
    data: items,
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  };
}

// ============================================================
// GET SINGLE REPORT CARD
// ============================================================
export async function getReportCardById(
  reportId: string,
  currentUser: AuthUser,
): Promise<ReportCard | null> {
  const supabase = await createSupabaseServerClient();

  let query = supabase
    .from("report_cards")
    .select(
      `
      *,
      students (
        first_name,
        last_name,
        admission_number
      ),
      classes (
        name
      ),
      academic_years (
        year
      ),
      terms (
        name
      )
    `,
    )
    .eq("report_id", reportId);

  if (currentUser.role !== "super_admin") {
    query = query.eq("school_id", currentUser.schoolId!);
  }

  const { data, error } = await query.single();

  if (error || !data) {
    return null;
  }

  const student = firstRelation(data.students);
  const classRecord = firstRelation(data.classes);
  const academicYear = firstRelation(data.academic_years);
  const term = firstRelation(data.terms);

  return {
    reportId: data.report_id,
    schoolId: data.school_id,
    studentId: data.student_id,
    studentName: student
      ? `${student.first_name} ${student.last_name}`.trim()
      : undefined,
    studentAdmissionNo: student?.admission_number || undefined,
    classId: data.class_id,
    className: classRecord?.name || undefined,
    academicYearId: data.academic_year_id,
    academicYear: academicYear?.year || null,
    termId: data.term_id,
    termName: term?.name || null,
    reportType: data.report_type,
    overallAverage: data.overall_average
      ? parseFloat(data.overall_average)
      : null,
    overallLevel: data.overall_level as PerformanceLevelLabel | null,
    classTeacherRemarks: data.class_teacher_remarks,
    principalRemarks: data.principal_remarks,
    analyticsJson: data.analytics_json,
    pdfUrl: data.pdf_url,
    isPublished: data.is_published,
    publishedAt: data.published_at,
    generatedAt: data.generated_at,
    generatedBy: data.generated_by,
  };
}

// ============================================================
// GENERATE REPORT CARD
// ============================================================
export async function generateReportCard(
  payload: GenerateReportCardInput,
  currentUser: AuthUser,
): Promise<{ success: boolean; message: string; reportId?: string }> {
  const supabase = await createSupabaseServerClient();
  const schoolId = currentUser.schoolId!;

  // Check if report already exists
  const { data: existing } = await supabase
    .from("report_cards")
    .select("report_id")
    .eq("student_id", payload.studentId)
    .eq("term_id", payload.termId)
    .eq("academic_year_id", payload.academicYearId)
    .eq("report_type", payload.reportType)
    .maybeSingle();

  // Calculate analytics
  let learningAreas;
  if (payload.reportType === "term") {
    learningAreas = await calculateAllLearningAreaSummaries(
      payload.studentId,
      payload.termId,
      payload.academicYearId,
      currentUser,
    );
  } else {
    learningAreas = await calculateYearlySummary(
      payload.studentId,
      payload.academicYearId,
      currentUser,
    );
  }

  const overallPerformance = await calculateOverallStudentPerformance(
    payload.studentId,
    payload.termId,
    payload.academicYearId,
    currentUser,
  );

  // Get attendance summary
  const attendance = await getStudentAttendanceSummary(
    payload.studentId,
    payload.termId,
    currentUser,
  );

  // Get trends (compare with previous terms)
  const trends = await calculateStudentTrends(
    payload.studentId,
    payload.academicYearId,
    currentUser,
  );

  // Build analytics JSON
  const analyticsJson: ReportAnalytics = {
    learningAreas,
    overallSummary: overallPerformance,
    attendance,
    trends,
  };

  const reportData = {
    school_id: schoolId,
    student_id: payload.studentId,
    class_id: payload.classId,
    academic_year_id: payload.academicYearId,
    term_id: payload.termId,
    report_type: payload.reportType,
    overall_average: overallPerformance.averageScore,
    overall_level: overallPerformance.overallLevel,
    class_teacher_remarks: payload.classTeacherRemarks || null,
    principal_remarks: payload.principalRemarks || null,
    analytics_json: analyticsJson,
    is_published: false,
    generated_by: currentUser.id,
  };

  if (existing) {
    // Update existing report
    const { error } = await supabase
      .from("report_cards")
      .update({
        ...reportData,
        generated_at: new Date().toISOString(),
      })
      .eq("report_id", existing.report_id);

    if (error) {
      return { success: false, message: `Update failed: ${error.message}` };
    }

    return {
      success: true,
      message: "Report card updated successfully.",
      reportId: existing.report_id,
    };
  } else {
    // Create new report
    const { data, error } = await supabase
      .from("report_cards")
      .insert(reportData)
      .select("report_id")
      .single();

    if (error) {
      return { success: false, message: `Generation failed: ${error.message}` };
    }

    return {
      success: true,
      message: "Report card generated successfully.",
      reportId: data.report_id,
    };
  }
}

// ============================================================
// GENERATE REPORT CARDS FOR ENTIRE CLASS
// ============================================================
export async function generateClassReportCards(
  classId: string,
  academicYearId: string,
  termId: string,
  reportType: "term" | "yearly",
  currentUser: AuthUser,
): Promise<{
  success: boolean;
  message: string;
  generated: number;
  failed: number;
}> {
  const supabase = await createSupabaseServerClient();
  const schoolId = currentUser.schoolId!;

  // Get all students in the class
  const { data: studentClasses } = await supabase
    .from("student_classes")
    .select("student_id")
    .eq("class_id", classId)
    .eq("academic_year_id", academicYearId)
    .eq("term_id", termId)
    .eq("school_id", schoolId)
    .eq("status", "active");

  if (!studentClasses || studentClasses.length === 0) {
    return {
      success: false,
      message: "No students found in this class.",
      generated: 0,
      failed: 0,
    };
  }

  let generated = 0;
  let failed = 0;

  for (const sc of studentClasses) {
    const result = await generateReportCard(
      {
        studentId: sc.student_id,
        classId,
        academicYearId,
        termId,
        reportType,
      },
      currentUser,
    );

    if (result.success) {
      generated++;
    } else {
      failed++;
    }
  }

  return {
    success: failed === 0,
    message: `Generated ${generated} report cards. Failed: ${failed}`,
    generated,
    failed,
  };
}

// ============================================================
// UPDATE REPORT CARD REMARKS
// ============================================================
export async function updateReportCardRemarks(
  reportId: string,
  payload: UpdateReportCardRemarksInput,
  currentUser: AuthUser,
): Promise<{ success: boolean; message: string }> {
  const supabase = await createSupabaseServerClient();

  const updateData: Record<string, any> = {};

  if (payload.classTeacherRemarks !== undefined) {
    updateData.class_teacher_remarks = payload.classTeacherRemarks || null;
  }
  if (payload.principalRemarks !== undefined) {
    updateData.principal_remarks = payload.principalRemarks || null;
  }

  let query = supabase
    .from("report_cards")
    .update(updateData)
    .eq("report_id", reportId);

  if (currentUser.role !== "super_admin") {
    query = query.eq("school_id", currentUser.schoolId!);
  }

  const { error } = await query;

  if (error) {
    return { success: false, message: `Update failed: ${error.message}` };
  }

  return { success: true, message: "Remarks updated successfully." };
}

// ============================================================
// PUBLISH SINGLE REPORT CARD
// ============================================================
export async function publishReportCard(
  reportId: string,
  currentUser: AuthUser,
): Promise<{ success: boolean; message: string }> {
  const supabase = await createSupabaseServerClient();

  let query = supabase
    .from("report_cards")
    .update({
      is_published: true,
      published_at: new Date().toISOString(),
    })
    .eq("report_id", reportId)
    .eq("is_published", false);

  if (currentUser.role !== "super_admin") {
    query = query.eq("school_id", currentUser.schoolId!);
  }

  const selectQuery = query.select("report_id").maybeSingle();
  const { data, error } = await selectQuery;

  if (error) {
    return {
      success: false,
      message: `Publish failed: ${error.message}`,
    };
  }

  if (!data) {
    return {
      success: false,
      message: "Report card not found or is already published.",
    };
  }

  return {
    success: true,
    message: "Report card published successfully.",
  };
}

// ============================================================
// PUBLISH REPORT CARDS
// ============================================================
export async function publishReportCards(
  payload: PublishReportCardsInput,
  currentUser: AuthUser,
): Promise<{ success: boolean; message: string; published: number }> {
  const supabase = await createSupabaseServerClient();

  let query = supabase
    .from("report_cards")
    .update({
      is_published: true,
      published_at: new Date().toISOString(),
    })
    .eq("class_id", payload.classId)
    .eq("academic_year_id", payload.academicYearId)
    .eq("term_id", payload.termId)
    .eq("report_type", payload.reportType)
    .eq("is_published", false);

  if (currentUser.role !== "super_admin") {
    query = query.eq("school_id", currentUser.schoolId!);
  }

  const { error, count } = await query.select("report_id");

  if (error) {
    return {
      success: false,
      message: `Publish failed: ${error.message}`,
      published: 0,
    };
  }

  return {
    success: true,
    message: `Published ${count || 0} report cards.`,
    published: count || 0,
  };
}

// ============================================================
// UNPUBLISH REPORT CARD (for corrections)
// ============================================================
export async function unpublishReportCard(
  reportId: string,
  currentUser: AuthUser,
): Promise<{ success: boolean; message: string }> {
  // Only admins can unpublish
  if (
    !["super_admin", "school_admin", "principal"].includes(currentUser.role)
  ) {
    return {
      success: false,
      message: "Only administrators can unpublish report cards.",
    };
  }

  const supabase = await createSupabaseServerClient();

  let query = supabase
    .from("report_cards")
    .update({
      is_published: false,
      published_at: null,
    })
    .eq("report_id", reportId);

  if (currentUser.role !== "super_admin") {
    query = query.eq("school_id", currentUser.schoolId!);
  }

  const { error } = await query;

  if (error) {
    return { success: false, message: `Unpublish failed: ${error.message}` };
  }

  return { success: true, message: "Report card unpublished successfully." };
}

// ============================================================
// UPDATE REPORT CARD PDF URL
// ============================================================
export async function updateReportCardPdfUrl(
  reportId: string,
  pdfUrl: string,
  currentUser: AuthUser,
): Promise<{ success: boolean; message: string }> {
  const supabase = await createSupabaseServerClient();

  let query = supabase
    .from("report_cards")
    .update({ pdf_url: pdfUrl })
    .eq("report_id", reportId);

  if (currentUser.role !== "super_admin") {
    query = query.eq("school_id", currentUser.schoolId!);
  }

  const { error } = await query;

  if (error) {
    return { success: false, message: `Update failed: ${error.message}` };
  }

  return { success: true, message: "PDF URL updated successfully." };
}
