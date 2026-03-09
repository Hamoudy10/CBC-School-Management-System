// app/api/attendance/route.ts
// GET attendance list, POST record attendance

import { NextRequest } from "next/server";
import { withAuth, withPermission } from "@/lib/api/withAuth";
import { validateBody, validateSearchParams } from "@/lib/api/validation";
import { apiSuccess, apiError, apiPaginated } from "@/lib/api/response";
import {
  recordAttendanceSchema,
  attendanceFilterSchema,
} from "@/features/attendance";
import {
  getAttendanceList,
  recordAttendance,
} from "@/features/attendance/services/attendance.service";

export const GET = withPermission(
  { module: "attendance", action: "view" },
  async (req: NextRequest, user) => {
    try {
      const params = validateSearchParams(req, attendanceFilterSchema);

      if (!params.success) {
        return apiError(params.error, 422);
      }

      const { page, pageSize, ...filters } = params.data;

      const result = await getAttendanceList(
        filters,
        user.school_id,
        page,
        pageSize,
      );

      if (!result.success) {
        return apiError(result.message || "Failed to fetch attendance", 500);
      }

      return apiPaginated(result.data, result.total, page, pageSize);
    } catch (error) {
      return apiError("Internal server error", 500);
    }
  },
);

export const POST = withPermission(
  { module: "attendance", action: "create" },
  async (req: NextRequest, user) => {
    try {
      const body = await req.json();
      const validation = validateBody(body, recordAttendanceSchema);

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
    } catch (error) {
      return apiError("Internal server error", 500);
    }
  },
);
