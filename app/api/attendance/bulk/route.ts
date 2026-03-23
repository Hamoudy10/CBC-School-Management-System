import { NextRequest } from "next/server";
import { withPermission } from "@/lib/api/withAuth";
import { apiError, apiSuccess } from "@/lib/api/response";
import { validateBody } from "@/lib/api/validation";
import { bulkAttendanceSchema } from "@/features/attendance";
import { recordBulkAttendance } from "@/features/attendance/services/attendance.service";

export const POST = withPermission(
  { module: "attendance", action: "create" },
  async (req: NextRequest, user) => {
    const rawBody = await req.json();
    const attendanceEntries = Array.isArray(rawBody.attendance)
      ? rawBody.attendance
      : Array.isArray(rawBody.entries)
        ? rawBody.entries
        : [];

    const normalizedBody = {
      class_id: rawBody.class_id ?? rawBody.classId,
      date: rawBody.date,
      term_id: rawBody.term_id ?? rawBody.termId ?? null,
      entries: attendanceEntries.map((entry: any) => ({
        student_id: entry.student_id ?? entry.studentId,
        status: entry.status,
        reason: entry.reason ?? entry.remarks ?? null,
        arrival_time: entry.arrival_time ?? entry.arrivalTime ?? null,
      })),
    };

    const validation = validateBody(normalizedBody, bulkAttendanceSchema);
    if (!validation.success) {
      return apiError(validation.error, 422);
    }

    const result = await recordBulkAttendance(validation.data, user.school_id, user.id);
    if (!result.success) {
      return apiError(result.message, 400);
    }

    return apiSuccess(
      {
        recorded: result.recorded,
        updated: result.updated,
      },
      result.message,
      201,
    );
  },
);
