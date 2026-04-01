// app/api/exams/calendar/route.ts
// ============================================================
// GET /api/exams/calendar - Get exam schedule in calendar-friendly format
// GET /api/exams/export - Export exam schedule as CSV
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { withPermission } from "@/lib/api/withAuth";
import { validateQuery } from "@/lib/api/validation";
import {
  errorResponse,
  successResponse,
  validationErrorResponse,
} from "@/lib/api/response";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  EXAM_SET_SELECT,
  normalizeExamSetRow,
  resolveAcademicContext,
} from "../_lib";

const calendarQuerySchema = z.object({
  classId: z.string().uuid().optional(),
  termId: z.string().uuid().optional(),
  academicYearId: z.string().uuid().optional(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

function escapeCSV(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export const GET = withPermission(
  "exams",
  "view",
  async (request: NextRequest, { user }) => {
    const { searchParams } = new URL(request.url);
    const format = searchParams.get("format") ?? "json";
    const validation = validateQuery(searchParams, calendarQuerySchema);

    if (!validation.success) {
      return validationErrorResponse(validation.errors!);
    }

    const { classId, termId, academicYearId, startDate, endDate } = validation.data!;

    try {
      const supabase = await createSupabaseServerClient();

      if (!user.schoolId) {
        return errorResponse("School context is required.", 400);
      }

      // Resolve academic context if not provided
      let resolvedTermId = termId;
      let resolvedAcademicYearId = academicYearId;

      if (!resolvedTermId || !resolvedAcademicYearId) {
        try {
          const context = await resolveAcademicContext(supabase, user.schoolId, {
            termId: resolvedTermId,
            academicYearId: resolvedAcademicYearId,
            requireTerm: false,
            requireAcademicYear: false,
          });
          resolvedTermId = resolvedTermId ?? context.termId;
          resolvedAcademicYearId = resolvedAcademicYearId ?? context.academicYearId;
        } catch {
          // If no active context, proceed without it
        }
      }

      let query = supabase
        .from("exam_sets")
        .select(
          `
          exam_set_id,
          school_id,
          exam_id,
          class_id,
          term_id,
          academic_year_id,
          exam_date,
          notes,
          created_by,
          created_at,
          exam_bank (
            exam_id,
            title,
            learning_area_id,
            learning_areas (
              learning_area_id,
              name
            )
          ),
          classes (
            class_id,
            name,
            grades (
              grade_id,
              name
            )
          ),
          terms (
            term_id,
            name
          ),
          academic_years (
            academic_year_id,
            year
          )
        `
        )
        .eq("school_id", user.schoolId);

      if (classId) {
        query = query.eq("class_id", classId);
      }
      if (resolvedTermId) {
        query = query.eq("term_id", resolvedTermId);
      }
      if (resolvedAcademicYearId) {
        query = query.eq("academic_year_id", resolvedAcademicYearId);
      }
      if (startDate) {
        query = query.gte("exam_date", startDate);
      }
      if (endDate) {
        query = query.lte("exam_date", endDate);
      }

      const { data, error } = await query.order("exam_date", { ascending: true });

      if (error) {
        return errorResponse(`Failed to load exam schedule: ${error.message}`, 500);
      }

      const exams = (data ?? []).map((row: any) => {
        const exam = row.exam_bank;
        const classData = Array.isArray(row.classes) ? row.classes[0] : row.classes;
        const grade = Array.isArray(classData?.grades) ? classData?.grades[0] : classData?.grades;
        const term = Array.isArray(row.terms) ? row.terms[0] : row.terms;
        const academicYear = Array.isArray(row.academic_years) ? row.academic_years[0] : row.academic_years;
        const learningArea = exam?.learning_areas;

        return {
          examSetId: row.exam_set_id,
          examDate: row.exam_date,
          examTitle: exam?.title ?? "Untitled Exam",
          learningAreaName: learningArea?.name ?? "",
          className: classData?.name ?? "",
          gradeName: grade?.name ?? "",
          termName: term?.name ?? "",
          academicYear: academicYear?.year ?? "",
          notes: row.notes,
        };
      });

      // CSV export
      if (format === "csv") {
        const headers = [
          "Date",
          "Exam Title",
          "Learning Area",
          "Class",
          "Grade",
          "Term",
          "Year",
          "Notes",
        ];

        const rows = exams.map((exam) =>
          [
            escapeCSV(exam.examDate),
            escapeCSV(exam.examTitle),
            escapeCSV(exam.learningAreaName),
            escapeCSV(exam.className),
            escapeCSV(exam.gradeName),
            escapeCSV(exam.termName),
            escapeCSV(exam.academicYear),
            escapeCSV(exam.notes ?? ""),
          ].join(","),
        );

        const csv = [headers.join(","), ...rows].join("\n");

        return new NextResponse(csv, {
          status: 200,
          headers: {
            "Content-Type": "text/csv; charset=utf-8",
            "Content-Disposition": 'attachment; filename="exam-schedule.csv"',
          },
        });
      }

      // Calendar format: group by date
      const calendarMap = new Map<string, typeof exams>();
      for (const exam of exams) {
        if (!calendarMap.has(exam.examDate)) {
          calendarMap.set(exam.examDate, []);
        }
        calendarMap.get(exam.examDate)!.push(exam);
      }

      const calendar = Array.from(calendarMap.entries())
        .map(([date, items]) => ({ date, exams: items }))
        .sort((a, b) => a.date.localeCompare(b.date));

      return successResponse({
        calendar,
        totalExams: exams.length,
        dateRange: {
          start: calendar.length > 0 ? calendar[0].date : null,
          end: calendar.length > 0 ? calendar[calendar.length - 1].date : null,
        },
      });
    } catch (err) {
      return errorResponse(
        err instanceof Error ? err.message : "Failed to load exam calendar.",
        500,
      );
    }
  },
);
