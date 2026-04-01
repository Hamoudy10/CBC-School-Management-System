// app/api/special-needs/export/route.ts
// ============================================================
// GET /api/special-needs/export - Export special needs records as CSV
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { withPermission } from "@/lib/api/withAuth";
import { validateQuery } from "@/lib/api/validation";
import { errorResponse, validationErrorResponse } from "@/lib/api/response";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { z } from "zod";

const querySchema = z.object({
  studentId: z.string().uuid().optional(),
  needsType: z.string().optional(),
  isActive: z.string().optional(),
});

function escapeCSV(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export const GET = withPermission(
  "special_needs",
  "export",
  async (request: NextRequest, { user }) => {
    const { searchParams } = new URL(request.url);
    const validation = validateQuery(searchParams, querySchema);

    if (!validation.success) {
      return validationErrorResponse(validation.errors!);
    }

    const { studentId, needsType, isActive } = validation.data!;

    try {
      const supabase = await createSupabaseServerClient();

      if (!user.schoolId) {
        return errorResponse("School context is required.", 400);
      }

      let query = supabase
        .from("special_needs")
        .select(
          `
          special_needs_id,
          student_id,
          needs_type,
          description,
          accommodations,
          assessment_adjustments,
          is_active,
          created_at,
          updated_at,
          students(first_name, last_name, admission_number, classes(name)),
          creator:users!special_needs_created_by_fkey(first_name, last_name)
        `
        )
        .eq("school_id", user.schoolId);

      if (studentId) query = query.eq("student_id", studentId);
      if (needsType) query = query.eq("needs_type", needsType);
      if (isActive !== undefined) query = query.eq("is_active", isActive === "true");

      const { data, error } = await query.order("created_at", { ascending: false });

      if (error) {
        return errorResponse(`Failed to load records: ${error.message}`, 500);
      }

      const headers = [
        "Student Name",
        "Admission No",
        "Class",
        "Needs Type",
        "Description",
        "Accommodations",
        "Assessment Adjustments",
        "Status",
        "Created By",
        "Created At",
        "Updated At",
      ];

      const rows = (data ?? []).map((row: any) => {
        const student = Array.isArray(row.students) ? row.students[0] : row.students;
        const classData = Array.isArray(student?.classes) ? student?.classes[0] : student?.classes;
        const creator = Array.isArray(row.creator) ? row.creator[0] : row.creator;

        return [
          escapeCSV(student ? `${student.first_name} ${student.last_name}`.trim() : ""),
          escapeCSV(student?.admission_number ?? ""),
          escapeCSV(classData?.name ?? ""),
          escapeCSV(row.needs_type ?? ""),
          escapeCSV(row.description ?? ""),
          escapeCSV(row.accommodations ?? ""),
          escapeCSV(row.assessment_adjustments ? JSON.stringify(row.assessment_adjustments) : ""),
          escapeCSV(row.is_active ? "Active" : "Inactive"),
          escapeCSV(creator ? `${creator.first_name} ${creator.last_name}`.trim() : ""),
          escapeCSV(row.created_at ?? ""),
          escapeCSV(row.updated_at ?? ""),
        ].join(",");
      });

      const csv = [headers.join(","), ...rows].join("\n");

      return new NextResponse(csv, {
        status: 200,
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": 'attachment; filename="special-needs.csv"',
        },
      });
    } catch (err) {
      return errorResponse(
        err instanceof Error ? err.message : "Failed to export special needs.",
        500,
      );
    }
  },
);
