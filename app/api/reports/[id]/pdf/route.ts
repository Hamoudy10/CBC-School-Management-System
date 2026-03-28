import { NextRequest, NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { withAuth } from "@/lib/api/withAuth";
import {
  errorResponse,
  forbiddenResponse,
  notFoundResponse,
  validationErrorResponse,
} from "@/lib/api/response";
import { validateUuid } from "@/lib/api/validation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { ReportCardDocument } from "@/features/reports/components/ReportCardPDF";
import { generateReportCardHTML } from "@/features/reports/services/pdf.service";
import type { CBCReportCardData } from "@/features/reports/types";
import type {
  AttendanceSummary,
  LearningAreaSummary,
  PerformanceLevelLabel,
  ReportAnalytics,
} from "@/features/assessments";

function firstRelation<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return value ?? null;
}

function toLevelCode(level: PerformanceLevelLabel | null | undefined) {
  switch (level) {
    case "exceeding":
      return "EE";
    case "meeting":
      return "ME";
    case "approaching":
      return "AE";
    case "below_expectation":
    default:
      return "BE";
  }
}

function toLevelLabel(level: PerformanceLevelLabel | null | undefined) {
  switch (level) {
    case "exceeding":
      return "Exceeding Expectation";
    case "meeting":
      return "Meeting Expectation";
    case "approaching":
      return "Approaching Expectation";
    case "below_expectation":
    default:
      return "Below Expectation";
  }
}

function buildReportCardData(row: any, school: any): CBCReportCardData {
  const analytics = (row.analytics_json ?? {}) as ReportAnalytics;
  const learningAreas = (analytics.learningAreas ?? []) as LearningAreaSummary[];
  const attendance = (analytics.attendance ?? null) as AttendanceSummary | null;
  const student = firstRelation(row.students) as
    | {
        student_id?: string;
        first_name?: string;
        last_name?: string;
        middle_name?: string | null;
        admission_number?: string;
        date_of_birth?: string | null;
        photo_url?: string | null;
      }
    | null;
  const classData = firstRelation(row.classes) as
    | {
        name?: string;
        stream?: string | null;
        grades?:
          | { name?: string | null; level_order?: number | null }
          | Array<{ name?: string | null; level_order?: number | null }>
          | null;
      }
    | null;
  const term = firstRelation(row.terms) as { name?: string | null } | null;
  const academicYear = firstRelation(row.academic_years) as
    | { year?: string | null }
    | null;
  const grade = firstRelation(classData?.grades);

  const overall = analytics.overallSummary ?? {
    totalCompetencies: 0,
    assessedCompetencies: 0,
    averageScore: Number(row.overall_average ?? 0),
    overallLevel: (row.overall_level ?? "below_expectation") as PerformanceLevelLabel,
    levelDistribution: {
      exceeding: 0,
      meeting: 0,
      approaching: 0,
      belowExpectation: 0,
    },
  };

  return {
    student: {
      student_id: row.student_id,
      admission_no: student?.admission_number ?? "",
      name: [student?.first_name, student?.middle_name, student?.last_name]
        .filter(Boolean)
        .join(" "),
      class_name: classData
        ? `${classData.name ?? ""}${classData.stream ? ` ${classData.stream}` : ""}`.trim()
        : "",
      term: term?.name ?? "",
      academic_year: academicYear?.year ?? "",
      date_of_birth: student?.date_of_birth ?? undefined,
      photo_url: student?.photo_url ?? undefined,
    },
    school: {
      name: school?.name ?? "School",
      address: school?.address ?? "",
      logo_url: school?.logo_url ?? undefined,
      motto: school?.motto ?? undefined,
      contact_phone: school?.contact_phone ?? undefined,
      contact_email: school?.contact_email ?? undefined,
    },
    learning_areas: learningAreas.map((learningArea) => ({
      name: learningArea.learningAreaName,
      average_score: learningArea.averageScore,
      level: toLevelCode(learningArea.level),
      level_label: toLevelLabel(learningArea.level),
      strands: (learningArea.strandSummaries ?? []).map((strand) => ({
        name: strand.strandName,
        average_score: strand.averageScore,
        level: toLevelCode(strand.level),
        sub_strands: (strand.subStrandSummaries ?? []).map((subStrand) => ({
          name: subStrand.subStrandName,
          score: subStrand.averageScore,
          level: toLevelCode(subStrand.level),
          level_label: toLevelLabel(subStrand.level),
        })),
      })),
      teacher_remarks: undefined,
    })),
    overall: {
      average_score: Number(overall.averageScore ?? row.overall_average ?? 0),
      level: toLevelCode(overall.overallLevel ?? row.overall_level),
      level_label: toLevelLabel(overall.overallLevel ?? row.overall_level),
      total_learning_areas: learningAreas.length,
      level_distribution: {
        exceeding: Number(overall.levelDistribution?.exceeding ?? 0),
        meeting: Number(overall.levelDistribution?.meeting ?? 0),
        approaching: Number(overall.levelDistribution?.approaching ?? 0),
        below: Number(overall.levelDistribution?.belowExpectation ?? 0),
      },
    },
    attendance: {
      total_days: Number(attendance?.totalDays ?? 0),
      present_days: Number(attendance?.presentDays ?? 0),
      absent_days: Number(attendance?.absentDays ?? 0),
      late_days: Number(attendance?.lateDays ?? 0),
      attendance_rate: Number(attendance?.attendancePercentage ?? 0),
    },
    behaviour_and_values: {
      items: [],
    },
    remarks: {
      class_teacher: row.class_teacher_remarks ?? undefined,
      principal: row.principal_remarks ?? undefined,
      parent_feedback: undefined,
    },
    dates: {
      report_generated: row.generated_at ?? new Date().toISOString(),
      closing_date: undefined,
      next_term_opening: undefined,
      opening_date: undefined,
    },
  };
}

export const GET = withAuth(async (request, { user, params }) => {
  const reportId = params?.id;
  if (!reportId) {
    return notFoundResponse("Report card ID required");
  }

  const validation = validateUuid(reportId);
  if (!validation.success) {
    return validationErrorResponse(validation.errors!);
  }

  const supabase = await createSupabaseServerClient();
  let reportQuery = supabase
    .from("report_cards")
    .select(
      `
      report_id,
      school_id,
      student_id,
      class_id,
      academic_year_id,
      term_id,
      report_type,
      overall_average,
      overall_level,
      class_teacher_remarks,
      principal_remarks,
      analytics_json,
      is_published,
      published_at,
      generated_at,
      students (
        student_id,
        first_name,
        last_name,
        middle_name,
        admission_number,
        date_of_birth,
        photo_url
      ),
      classes (
        name,
        stream,
        grades ( name, level_order )
      ),
      terms ( name ),
      academic_years ( year )
    `,
    )
    .eq("report_id", reportId);

  if (user.role !== "super_admin") {
    reportQuery = reportQuery.eq("school_id", user.schoolId!);
  }

  const { data: reportCard, error: reportError } = await reportQuery.maybeSingle();

  if (reportError) {
    return errorResponse(`Failed to fetch report card: ${reportError.message}`, 500);
  }

  if (!reportCard) {
    return notFoundResponse("Report card not found");
  }

  if (user.role === "parent") {
    if (!reportCard.is_published) {
      return forbiddenResponse("Report card is not yet published");
    }

    const { data: guardianLink } = await supabase
      .from("student_guardians")
      .select("student_id")
      .eq("guardian_user_id", user.id)
      .eq("student_id", reportCard.student_id)
      .maybeSingle();

    if (!guardianLink) {
      return forbiddenResponse("You can only access your own children's reports");
    }
  }

  if (user.role === "student") {
    if (!reportCard.is_published) {
      return forbiddenResponse("Report card is not yet published");
    }

    const { data: studentRecord } = await supabase
      .from("students")
      .select("student_id")
      .eq("user_id", user.id)
      .eq("student_id", reportCard.student_id)
      .maybeSingle();

    if (!studentRecord) {
      return forbiddenResponse("You can only access your own reports");
    }
  }

  const { data: school, error: schoolError } = await supabase
    .from("schools")
    .select("name, address, contact_phone, contact_email, logo_url, motto")
    .eq("school_id", reportCard.school_id)
    .maybeSingle();

  if (schoolError || !school) {
    return errorResponse(
      schoolError?.message || "School information not found",
      500,
    );
  }

  const pdfData = buildReportCardData(reportCard, school);
  const searchParams = new URL(request.url).searchParams;
  const format = searchParams.get("format") ?? "pdf";

  if (format === "html") {
    const html = generateReportCardHTML(pdfData);
    return new NextResponse(html, {
      status: 200,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
      },
    });
  }

  try {
    const pdfBuffer = await renderToBuffer(
      ReportCardDocument({ data: pdfData }),
    );

    const filename = `report-card-${pdfData.student.admission_no || reportCard.report_id}.pdf`;

    return new NextResponse(pdfBuffer, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Content-Length": pdfBuffer.length.toString(),
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch (pdfError) {
    console.error("PDF generation failed:", pdfError);

    const html = generateReportCardHTML(pdfData);
    return new NextResponse(html, {
      status: 200,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "X-PDF-Fallback": "true",
      },
    });
  }
});
