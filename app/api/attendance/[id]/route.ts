import { NextRequest } from "next/server";
import { withPermission } from "@/lib/api/withAuth";
import { apiError, apiSuccess } from "@/lib/api/response";
import { validateBody } from "@/lib/api/validation";
import { getAttendanceById, updateAttendance, deleteAttendance } from "@/features/attendance/services/attendance.service";
import { updateAttendanceSchema } from "@/features/attendance";

export const GET = withPermission(
  { module: "attendance", action: "view" },
  async (_req: NextRequest, user, { params }: { params: { id: string } }) => {
    const result = await getAttendanceById(params.id, user.school_id);
    if (!result.success) {
      return apiError(result.message ?? "Attendance record not found", 404);
    }

    return apiSuccess(result.data);
  },
);

export const PUT = withPermission(
  { module: "attendance", action: "update" },
  async (req: NextRequest, user, { params }: { params: { id: string } }) => {
    const rawBody = await req.json();
    const normalizedBody = {
      class_id: rawBody.class_id ?? rawBody.classId,
      date: rawBody.date,
      status: rawBody.status,
      reason: rawBody.reason ?? rawBody.remarks ?? null,
      arrival_time: rawBody.arrival_time ?? rawBody.arrivalTime ?? null,
      term_id: rawBody.term_id ?? rawBody.termId ?? null,
    };

    const validation = validateBody(normalizedBody, updateAttendanceSchema);
    if (!validation.success) {
      return apiError(validation.error, 422);
    }

    const result = await updateAttendance(params.id, user.school_id, {
      ...validation.data,
      recorded_by: user.id,
    });

    if (!result.success) {
      return apiError(result.message, 400);
    }

    return apiSuccess({ id: params.id }, result.message);
  },
);

export const DELETE = withPermission(
  { module: "attendance", action: "delete" },
  async (_req: NextRequest, user, { params }: { params: { id: string } }) => {
    const result = await deleteAttendance(params.id, user.school_id);
    if (!result.success) {
      return apiError(result.message, 400);
    }

    return apiSuccess({ id: params.id }, result.message);
  },
);
