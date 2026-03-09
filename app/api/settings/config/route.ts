// app/api/settings/config/route.ts
// GET system configuration, PUT update settings

import { NextRequest } from "next/server";
import { withAuth, withPermission } from "@/lib/api/withAuth";
import { validateBody } from "@/lib/api/validation";
import { apiSuccess, apiError } from "@/lib/api/response";
import { updateSettingsSchema } from "@/features/settings";
import {
  getSchoolSettings,
  updateSchoolSettings,
} from "@/features/settings/services/school.service";
import { getSystemConfig } from "@/features/settings/services/classes.service";

export const GET = withAuth(async (req: NextRequest, user) => {
  try {
    const result = await getSystemConfig(user.school_id);

    if (!result.success) {
      return apiError(result.message || "Failed to load config", 500);
    }

    return apiSuccess(result.data);
  } catch (error) {
    return apiError("Internal server error", 500);
  }
});

export const PUT = withPermission(
  { module: "settings", action: "edit" },
  async (req: NextRequest, user) => {
    try {
      const body = await req.json();
      const validation = validateBody(body, updateSettingsSchema);

      if (!validation.success) {
        return apiError(validation.error, 422);
      }

      const result = await updateSchoolSettings(
        user.school_id,
        validation.data,
      );

      if (!result.success) {
        return apiError(result.message, 400);
      }

      return apiSuccess(null, result.message);
    } catch (error) {
      return apiError("Internal server error", 500);
    }
  },
);
