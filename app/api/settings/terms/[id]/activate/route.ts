// app/api/settings/terms/[id]/activate/route.ts
// POST set active term

import { NextRequest } from "next/server";
import { withPermission } from "@/lib/api/withAuth";
import { apiSuccess, apiError } from "@/lib/api/response";
import { setActiveTerm } from "@/features/settings/services/academicYear.service";

export const POST = withPermission(
  { module: "settings", action: "edit" },
  async (req: NextRequest, user, { params }: { params: { id: string } }) => {
    try {
      const result = await setActiveTerm(params.id, user.school_id);

      if (!result.success) {
        return apiError(result.message, 400);
      }

      return apiSuccess(null, result.message);
    } catch (error) {
      return apiError("Internal server error", 500);
    }
  },
);
