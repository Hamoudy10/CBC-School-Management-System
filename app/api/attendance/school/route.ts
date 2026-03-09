// app/api/attendance/school/route.ts
// GET school-wide daily attendance overview

import { NextRequest } from "next/server";
import { withPermission } from "@/lib/api/withAuth";
import { apiSuccess, apiError } from "@/lib/api/response";
import { getDailySchoolAttendance } from "@/features/attendance/services/attendance.service";

export const GET = withPermission(
  { module: "attendance", action: "view" },
  async (req: NextRequest, user) => {
    try {
      const { searchParams } = new URL(req.url);
      const date =
        searchParams.get("date") || new Date().toISOString().split("T")[0];

      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        return apiError("Date must be in YYYY-MM-DD format", 422);
      }

      const result = await getDailySchoolAttendance(user.school_id, date);

      if (!result.success) {
        return apiError(
          result.message || "Failed to fetch school attendance",
          500,
        );
      }

      return apiSuccess(result.data);
    } catch (error) {
      return apiError("Internal server error", 500);
    }
  },
);
