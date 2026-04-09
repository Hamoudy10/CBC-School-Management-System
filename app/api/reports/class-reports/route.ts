export const dynamic = 'force-dynamic';

// app/api/reports/class-report/route.ts
// POST generate class performance report

import { NextRequest } from "next/server";
import { withPermission } from "@/lib/api/withAuth";
import { validateBody } from "@/lib/api/validation";
import { apiSuccess, apiError } from "@/lib/api/response";
import { generateClassReportSchema } from "@/features/reports";
import { generateClassReport } from "@/features/reports/services/reports.service";

export const POST = withPermission(
  { module: "reports", action: "create" },
  async (req: NextRequest, user) => {
    try {
      const body = await req.json();
      const validation = validateBody(body, generateClassReportSchema);

      if (!validation.success) {
        return apiError(validation.error, 422);
      }

      const { class_id, term, academic_year } = validation.data;

      const result = await generateClassReport(
        class_id,
        term,
        academic_year,
        user.school_id,
      );

      if (!result.success) {
        return apiError(result.message, 400);
      }

      return apiSuccess(result.data, result.message);
    } catch (error) {
      return apiError("Internal server error", 500);
    }
  },
);
