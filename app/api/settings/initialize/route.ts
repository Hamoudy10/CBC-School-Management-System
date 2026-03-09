// app/api/settings/initialize/route.ts
// POST initialize default settings for a school

import { NextRequest } from "next/server";
import { withPermission } from "@/lib/api/withAuth";
import { apiSuccess, errorResponse } from "@/lib/api/response";
import { getSchoolSettings } from "@/features/settings/services/school.service";

export const POST = withPermission(
  "settings",
  "create",
  async (req: NextRequest, user: any) => {
    try {
      const result = await getSchoolSettings(user.school_id);
      if (!result.success) {
        return errorResponse(result.message || "Failed to initialize settings", 400);
      }

      return apiSuccess(
        { success: true, message: "Default settings initialized" },
        "Default settings initialized",
        201,
      );
    } catch (error: any) {
      return errorResponse(error.message, 500);
    }
  },
);
