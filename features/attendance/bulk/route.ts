// app/api/attendance/bulk/route.ts
// POST bulk attendance entry for a class

import { NextRequest } from "next/server";
import { withPermission } from "@/lib/api/withAuth";
import { validateBody } from "@/lib/api/validation";
import { apiSuccess, apiError } from "@/lib/api/response";
import { bulkAttendanceSchema } from "@/features/attendance";
import { recordBulkAttendance } from "@/features/attendance/services/attendance.service";

export const POST = withPermission(
  { module: "attendance", action: "create" },
  async (req: NextRequest, user) => {
    try {
      const body = await req.json();
      const validation = validateBody(body, bulkAttendanceSchema);

      if (!validation.success) {
        return apiError(validation.error, 422);
      }

      const result = await recordBulkAttendance(
        validation.data,
        user.school_id,
        user.id,
      );

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
    } catch (error) {
      return apiError("Internal server error", 500);
    }
  },
);
