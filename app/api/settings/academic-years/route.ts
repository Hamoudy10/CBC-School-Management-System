// app/api/settings/academic-years/route.ts
// GET list, POST create academic year

import { NextRequest } from "next/server";
import { withAuth, withPermission } from "@/lib/api/withAuth";
import { validateBody } from "@/lib/api/validation";
import { apiSuccess, apiError } from "@/lib/api/response";
import { createAcademicYearSchema } from "@/features/settings";
import {
  getAcademicYears,
  createAcademicYear,
} from "@/features/settings/services/academicYear.service";

export const GET = withAuth(async (req: NextRequest, user) => {
  try {
    const result = await getAcademicYears(user.school_id);

    if (!result.success) {
      return apiError(result.message || "Failed to fetch academic years", 500);
    }

    return apiSuccess(result.data);
  } catch (error) {
    return apiError("Internal server error", 500);
  }
});

export const POST = withPermission(
  { module: "settings", action: "create" },
  async (req: NextRequest, user) => {
    try {
      const body = await req.json();
      const validation = validateBody(body, createAcademicYearSchema);

      if (!validation.success) {
        return apiError(validation.error, 422);
      }

      const result = await createAcademicYear(validation.data, user.school_id);

      if (!result.success) {
        return apiError(result.message, 400);
      }

      return apiSuccess({ id: result.id }, result.message, 201);
    } catch (error) {
      return apiError("Internal server error", 500);
    }
  },
);
