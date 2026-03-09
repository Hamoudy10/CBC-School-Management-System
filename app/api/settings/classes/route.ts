// app/api/settings/classes/route.ts
// GET classes, POST create class

import { NextRequest } from "next/server";
import { withAuth, withPermission } from "@/lib/api/withAuth";
import { validateBody } from "@/lib/api/validation";
import { apiSuccess, apiError } from "@/lib/api/response";
import { createClassSchema } from "@/features/settings";
import {
  getClasses,
  createClass,
} from "@/features/settings/services/classes.service";

export const GET = withAuth(async (req: NextRequest, user) => {
  try {
    const { searchParams } = new URL(req.url);
    const academicYear = searchParams.get("academic_year") || undefined;
    const gradeLevel = searchParams.get("grade_level")
      ? parseInt(searchParams.get("grade_level")!)
      : undefined;
    const status = searchParams.get("status") || undefined;

    const result = await getClasses(user.school_id, {
      academic_year: academicYear,
      grade_level: gradeLevel,
      status,
    });

    if (!result.success) {
      return apiError(result.message || "Failed to fetch classes", 500);
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
      const validation = validateBody(body, createClassSchema);

      if (!validation.success) {
        return apiError(validation.error, 422);
      }

      const result = await createClass(validation.data, user.school_id);

      if (!result.success) {
        return apiError(result.message, 400);
      }

      return apiSuccess({ id: result.id }, result.message, 201);
    } catch (error) {
      return apiError("Internal server error", 500);
    }
  },
);
