// app/api/report-cards/publish/route.ts
// ============================================================
// POST /api/report-cards/publish - Publish report cards for class
// ============================================================

import { NextRequest } from "next/server";
import { withPermission } from "@/lib/api/withAuth";
import { validateBody } from "@/lib/api/validation";
import {
  successResponse,
  errorResponse,
  validationErrorResponse,
} from "@/lib/api/response";
import {
  publishReportCards,
  publishReportCardsSchema,
} from "@/features/assessments";

// ============================================================
// POST Handler - Publish Report Cards
// ============================================================
export const POST = withPermission(
  "reports",
  "publish",
  async (request, { user }) => {
    const validation = await validateBody(request, publishReportCardsSchema);
    if (!validation.success) {
      return validationErrorResponse(validation.errors!);
    }

    const result = await publishReportCards(validation.data!, user);

    if (!result.success) {
      return errorResponse(result.message);
    }

    return successResponse({
      message: result.message,
      published: result.published,
    });
  },
);
