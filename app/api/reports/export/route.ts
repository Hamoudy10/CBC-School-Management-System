import { NextResponse } from "next/server";
import { withPermission } from "@/lib/api/withAuth";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type ReportExportRow = {
  report_id: string;
  student_id: string;
  report_type: "term" | "yearly";
  overall_average: number | null;
  overall_level: string | null;
  is_published: boolean;
  generated_at: string;
  students:
    | {
        first_name?: string | null;
        last_name?: string | null;
        admission_number?: string | null;
      }
    | Array<{
        first_name?: string | null;
        last_name?: string | null;
        admission_number?: string | null;
      }>
    | null;
  classes:
    | {
        name?: string | null;
        stream?: string | null;
      }
    | Array<{
        name?: string | null;
        stream?: string | null;
      }>
    | null;
  terms:
    | {
        name?: string | null;
      }
    | Array<{
        name?: string | null;
      }>
    | null;
  academic_years:
    | {
        year?: string | null;
      }
    | Array<{
        year?: string | null;
      }>
    | null;
};

function firstRelation<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return value ?? null;
}

function escapeCsv(value: unknown) {
  const stringValue = String(value ?? "");
  if (
    stringValue.includes(",") ||
    stringValue.includes("\"") ||
    stringValue.includes("\n")
  ) {
    return `"${stringValue.replace(/"/g, "\"\"")}"`;
  }

  return stringValue;
}

export const GET = withPermission(
  "reports",
  "export",
  async (request, { user }) => {
    const supabase = await createSupabaseServerClient();
    const { searchParams, origin } = new URL(request.url);
    const termId = searchParams.get("term");
    const classId = searchParams.get("class");
    const studentId = searchParams.get("student");
    const status = searchParams.get("status");
    const reportType = searchParams.get("reportType");
    let academicYearId = searchParams.get("academicYearId");

    if (!academicYearId) {
      const { data: activeAcademicYear } = await supabase
        .from("academic_years")
        .select("academic_year_id")
        .eq("school_id", user.schoolId!)
        .eq("is_active", true)
        .maybeSingle();

      academicYearId = activeAcademicYear?.academic_year_id ?? null;
    }

    let query = supabase
      .from("report_cards")
      .select(
        `
        report_id,
        student_id,
        report_type,
        overall_average,
        overall_level,
        is_published,
        generated_at,
        students ( first_name, last_name, admission_number ),
        classes ( name, stream ),
        terms ( name ),
        academic_years ( year )
      `,
      )
      .eq("school_id", user.schoolId!);

    if (academicYearId) {
      query = query.eq("academic_year_id", academicYearId);
    }
    if (termId) {
      query = query.eq("term_id", termId);
    }
    if (classId) {
      query = query.eq("class_id", classId);
    }
    if (studentId) {
      query = query.eq("student_id", studentId);
    }
    if (status === "published") {
      query = query.eq("is_published", true);
    } else if (status === "draft") {
      query = query.eq("is_published", false);
    }
    if (reportType) {
      query = query.eq("report_type", reportType);
    }

    const { data, error } = await query.order("generated_at", {
      ascending: false,
    });

    if (error) {
      return NextResponse.json(
        { success: false, data: null, error: error.message },
        { status: 500 },
      );
    }

    const rows = [
      [
        "Student",
        "Admission Number",
        "Class",
        "Term",
        "Academic Year",
        "Report Type",
        "Average Score",
        "Performance",
        "Status",
        "Generated At",
        "Detail URL",
        "PDF URL",
        "Print URL",
      ].join(","),
      ...((data ?? []) as ReportExportRow[]).map((row) => {
        const student = firstRelation(row.students);
        const classRecord = firstRelation(row.classes);
        const term = firstRelation(row.terms);
        const academicYear = firstRelation(row.academic_years);
        const className = classRecord
          ? `${classRecord.name ?? ""}${classRecord.stream ? ` ${classRecord.stream}` : ""}`.trim()
          : "";

        return [
          escapeCsv(
            `${student?.first_name ?? ""} ${student?.last_name ?? ""}`.trim(),
          ),
          escapeCsv(student?.admission_number ?? ""),
          escapeCsv(className),
          escapeCsv(term?.name ?? ""),
          escapeCsv(academicYear?.year ?? ""),
          escapeCsv(row.report_type),
          escapeCsv(
            row.overall_average !== null
              ? Number(row.overall_average).toFixed(2)
              : "",
          ),
          escapeCsv(row.overall_level ?? ""),
          escapeCsv(row.is_published ? "Published" : "Draft"),
          escapeCsv(row.generated_at),
          escapeCsv(`${origin}/reports/${row.report_id}`),
          escapeCsv(`${origin}/api/reports/${row.report_id}/pdf`),
          escapeCsv(`${origin}/api/reports/${row.report_id}/pdf?format=html`),
        ].join(",");
      }),
    ];

    return new NextResponse(rows.join("\n"), {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="reports-export-${new Date()
          .toISOString()
          .split("T")[0]}.csv"`,
      },
    });
  },
);
