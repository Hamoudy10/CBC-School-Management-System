// app/api/attendance/summary/class/[classId]/route.ts
// GET class attendance summary for date range

import { NextRequest } from "next/server";
import { withPermission } from "@/lib/api/withAuth";
import { apiSuccess, apiError } from "@/lib/api/response";
import { getClassAttendanceSummary } from "@/features/attendance/services/attendance.service";

export const GET = withPermission(
  { module: "attendance", action: "view" },
  async (
    req: NextRequest,
    user,
    { params }: { params: { classId: string } },
  ) => {
    try {
      const { searchParams } = new URL(req.url);
      const dateFrom = searchParams.get("date_from");
      const dateTo = searchParams.get("date_to");

      if (!dateFrom || !dateTo) {
        return apiError("date_from and date_to parameters are required", 422);
      }

      if (
        !/^\d{4}-\d{2}-\d{2}$/.test(dateFrom) ||
        !/^\d{4}-\d{2}-\d{2}$/.test(dateTo)
      ) {
        return apiError("Dates must be in YYYY-MM-DD format", 422);
      }

      const result = await getClassAttendanceSummary(
        params.classId,
        user.school_id,
        dateFrom,
        dateTo,
      );

      if (!result.success) {
        return apiError(result.message || "Failed to fetch class summary", 500);
      }

      return apiSuccess(result.data);
    } catch (error) {
      return apiError("Internal server error", 500);
    }
  },
);
