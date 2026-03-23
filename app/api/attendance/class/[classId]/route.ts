import { NextRequest } from "next/server";
import { withPermission } from "@/lib/api/withAuth";
import { apiError, apiSuccess } from "@/lib/api/response";
import { getClassAttendanceForDate } from "@/features/attendance/services/attendance.service";

export const GET = withPermission(
  { module: "attendance", action: "view" },
  async (req: NextRequest, user, { params }: { params: { classId: string } }) => {
    const { searchParams } = new URL(req.url);
    const date = searchParams.get("date");

    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return apiError("Valid date parameter (YYYY-MM-DD) is required", 422);
    }

    const result = await getClassAttendanceForDate(params.classId, date, user.school_id);
    if (!result.success) {
      return apiError(result.message ?? "Failed to fetch class attendance", 500);
    }

    return apiSuccess(result.data);
  },
);
