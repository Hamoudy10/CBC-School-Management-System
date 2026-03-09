// app/api/discipline/summary/route.ts
// GET discipline summary/analytics

import { NextRequest } from "next/server";
import { withPermission } from "@/lib/api/withAuth";
import { apiSuccess, apiError } from "@/lib/api/response";
import { getDisciplineSummary } from "@/features/discipline/services/discipline.service";

export const GET = withPermission(
  { module: "compliance", action: "view" },
  async (req: NextRequest, user) => {
    try {
      const { searchParams } = new URL(req.url);

      const filters = {
        class_id: searchParams.get("class_id") || undefined,
        term: searchParams.get("term") || undefined,
        academic_year: searchParams.get("academic_year") || undefined,
        date_from: searchParams.get("date_from") || undefined,
        date_to: searchParams.get("date_to") || undefined,
      };

      const result = await getDisciplineSummary(user.school_id, filters);

      if (!result.success) {
        return apiError(result.message || "Failed to fetch summary", 500);
      }

      return apiSuccess(result.data);
    } catch (error) {
      return apiError("Internal server error", 500);
    }
  },
);
