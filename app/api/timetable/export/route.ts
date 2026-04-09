export const dynamic = 'force-dynamic';

// app/api/timetable/export/route.ts
// ============================================================
// GET /api/timetable/export - Export timetable as CSV
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { withPermission } from "@/lib/api/withAuth";
import { validateQuery } from "@/lib/api/validation";
import { errorResponse, validationErrorResponse } from "@/lib/api/response";
import { timetableService } from "@/features/timetable/services/timetable.service";

const querySchema = z.object({
  classId: z.string().uuid().optional(),
  teacherId: z.string().uuid().optional(),
  termId: z.string().uuid(),
  academicYearId: z.string().uuid(),
});

const DAY_NAMES = ["", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];

function escapeCSV(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export const GET = withPermission(
  "timetable",
  "view",
  async (request: NextRequest, { user }) => {
    const { searchParams } = new URL(request.url);
    const validation = validateQuery(searchParams, querySchema);

    if (!validation.success) {
      return validationErrorResponse(validation.errors!);
    }

    const { classId, teacherId, termId, academicYearId } = validation.data!;

    try {
      const result = await timetableService.getSlots(
        {
          classId,
          teacherId,
          termId,
          academicYearId,
          limit: 500,
        },
        user,
      );

      const headers = [
        "Day",
        "Start Time",
        "End Time",
        "Class",
        "Grade",
        "Learning Area",
        "Teacher",
        "Room",
      ];

      const rows = result.data.map((slot: any) =>
        [
          escapeCSV(slot.dayName ?? DAY_NAMES[slot.dayOfWeek] ?? ""),
          escapeCSV(slot.startTime ?? ""),
          escapeCSV(slot.endTime ?? ""),
          escapeCSV(slot.className ?? ""),
          escapeCSV(slot.gradeName ?? ""),
          escapeCSV(slot.learningAreaName ?? ""),
          escapeCSV(slot.teacherName ?? ""),
          escapeCSV(slot.room ?? ""),
        ].join(","),
      );

      const csv = [headers.join(","), ...rows].join("\n");

      return new NextResponse(csv, {
        status: 200,
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": 'attachment; filename="timetable.csv"',
        },
      });
    } catch (err) {
      return errorResponse(
        err instanceof Error ? err.message : "Failed to export timetable.",
        500,
      );
    }
  },
);
