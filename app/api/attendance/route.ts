import { NextRequest } from "next/server";
import { withPermission } from "@/lib/api/withAuth";
import { apiError, apiPaginated, apiSuccess } from "@/lib/api/response";
import { validateBody, validateSearchParams } from "@/lib/api/validation";
import { attendanceFilterSchema, recordAttendanceSchema } from "@/features/attendance";
import { getAttendanceList, recordAttendance } from "@/features/attendance/services/attendance.service";

export const GET = withPermission(
  { module: "attendance", action: "view" },
  async (req: NextRequest, user) => {
    const params = validateSearchParams(req, attendanceFilterSchema);
    if (!params.success) {
      return apiError(params.error, 422);
    }

    const { page, pageSize, ...filters } = params.data;
    const result = await getAttendanceList(filters, user.school_id, page, pageSize);

    if (!result.success) {
      return apiError(result.message ?? "Failed to fetch attendance", 500);
    }

    return apiPaginated(result.data, result.total, page, pageSize);
  },
);

export const POST = withPermission(
  { module: "attendance", action: "create" },
  async (req: NextRequest, user) => {
    const rawBody = await req.json();
    const normalizedBody = {
      student_id: rawBody.student_id ?? rawBody.studentId,
      class_id: rawBody.class_id ?? rawBody.classId,
      date: rawBody.date,
      status: rawBody.status,
      reason: rawBody.reason ?? rawBody.remarks ?? null,
      arrival_time: rawBody.arrival_time ?? rawBody.arrivalTime ?? null,
      term_id: rawBody.term_id ?? rawBody.termId ?? null,
    };

    const validation = validateBody(normalizedBody, recordAttendanceSchema);
    if (!validation.success) {
      return apiError(validation.error, 422);
    }

    const result = await recordAttendance({
      ...validation.data,
      recorded_by: user.id,
      school_id: user.school_id,
    });

    if (!result.success) {
      return apiError(result.message, 400);
    }

    return apiSuccess({ id: result.id }, result.message, 201);
  },
);
