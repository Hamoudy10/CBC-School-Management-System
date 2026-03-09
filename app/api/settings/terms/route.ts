// app/api/settings/terms/route.ts
// GET terms for academic year, POST create term

import { NextRequest } from "next/server";
import { withAuth, withPermission } from "@/lib/api/withAuth";
import { validateBody } from "@/lib/api/validation";
import { apiSuccess, apiError } from "@/lib/api/response";
import { createTermSchema } from "@/features/settings";
import {
  getActiveAcademicYear,
  getTerms,
  createTerm,
} from "@/features/settings/services/academicYear.service";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const GET = withAuth(async (req: NextRequest, user) => {
  try {
    const { searchParams } = new URL(req.url);
    let academicYearId = searchParams.get("academic_year_id");

    if (!academicYearId) {
      const activeYear = await getActiveAcademicYear(user.school_id);
      academicYearId = activeYear.success ? activeYear.data?.id ?? null : null;
    }

    if (!academicYearId) {
      return apiSuccess([]);
    }

    const result = await getTerms(academicYearId, user.school_id);

    if (!result.success) {
      return apiError(result.message || "Failed to fetch terms", 500);
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
      const validation = validateBody(body, createTermSchema);

      if (!validation.success) {
        return apiError(validation.error, 422);
      }

      const result = await createTerm(validation.data, user.school_id);

      if (!result.success) {
        return apiError(result.message, 400);
      }

      return apiSuccess({ id: result.id }, result.message, 201);
    } catch (error) {
      return apiError("Internal server error", 500);
    }
  },
);
