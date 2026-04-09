export const dynamic = 'force-dynamic';

// app/api/reports/batch-report-cards/route.ts
// POST generate report cards for entire class

import { NextRequest } from "next/server";
import { withPermission } from "@/lib/api/withAuth";
import { validateBody } from "@/lib/api/validation";
import { apiSuccess, apiError } from "@/lib/api/response";
import { generateBatchReportSchema } from "@/features/reports";
import { generateClassReportCards } from "@/features/reports/services/reports.service";
import { rateLimit } from "@/lib/api/rateLimit";

export const POST = withPermission(
  { module: "reports", action: "create" },
  async (req: NextRequest, user) => {
    try {
      // Rate limit: 5 batch generations per hour
      const rateLimitResult = rateLimit(`batch-reports:${user.id}`, 5, 3600);
      if (!rateLimitResult.allowed) {
        return apiError(
          `Rate limit exceeded. Try again in ${rateLimitResult.retryAfter} seconds.`,
          429,
        );
      }

      const body = await req.json();
      const validation = validateBody(body, generateBatchReportSchema);

      if (!validation.success) {
        return apiError(validation.error, 422);
      }

      const { class_id, term, academic_year } = validation.data;

      const result = await generateClassReportCards(
        class_id,
        term,
        academic_year,
        user.school_id,
        user.id,
      );

      return apiSuccess(
        {
          generated: result.generated,
          failed: result.failed,
          errors: result.errors,
        },
        result.message,
        result.success ? 201 : 207,
      );
    } catch (error) {
      return apiError("Internal server error", 500);
    }
  },
);
