import * as XLSX from "xlsx";
import { withPermission } from "@/lib/api/withAuth";
import { apiError } from "@/lib/api/response";
import { getAttendanceExportRows } from "@/features/attendance/services/attendance.service";

export const GET = withPermission(
  { module: "attendance", action: "export" },
  async (request, user) => {
    const { searchParams } = new URL(request.url);
    const date = searchParams.get("date");
    const classId = searchParams.get("classId") || searchParams.get("class_id") || undefined;

    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return apiError("Valid date parameter (YYYY-MM-DD) is required", 422);
    }

    try {
      const rows = await getAttendanceExportRows(user.school_id, date, classId);
      const worksheet = XLSX.utils.json_to_sheet(rows);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, classId ? "Roll Call" : "Summary");
      const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });

      return new Response(buffer, {
        status: 200,
        headers: {
          "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "Content-Disposition": `attachment; filename="attendance-${date}.xlsx"`,
        },
      });
    } catch (error) {
      return apiError(error instanceof Error ? error.message : "Failed to export attendance", 500);
    }
  },
);
