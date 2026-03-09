// app/api/attendance/class/[classId]/route.ts
// GET class attendance for a specific date

import { NextRequest } from "next/server";
import { withPermission } from "@/lib/api/withAuth";
import { apiSuccess, apiError } from "@/lib/api/response";
import { getClassAttendanceForDate } from "@/features/attendance/services/attendance.service";

export const GET = withPermission(
  { module: "attendance", action: "view" },
  async (
    req: NextRequest,
    user,
    { params }: { params: { classId: string } },
  ) => {
    try {
      const { searchParams } = new URL(req.url);
      const date = searchParams.get("date");

      if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        return apiError("Valid date parameter (YYYY-MM-DD) is required", 422);
      }

      const result = await getClassAttendanceForDate(
        params.classId,
        date,
        user.school_id,
      );

      if (!result.success) {
        return apiError(
          result.message || "Failed to fetch class attendance",
          500,
        );
      }

      return apiSuccess({
        records: result.data,
        stats: result.stats,
      });
    } catch (error) {
      return apiError("Internal server error", 500);
    }
  },
);
