// app/api/reports/report-cards/route.ts
// ============================================================
// POST /api/reports/report-cards - Generate or refresh a single report card
// ============================================================

import { withPermission } from "@/lib/api/withAuth";
import { validateBody, validateQuery } from "@/lib/api/validation";
import {
  createdResponse,
  errorResponse,
  successResponse,
  validationErrorResponse,
} from "@/lib/api/response";
import {
  generateReportCard,
  generateReportCardSchema,
  listReportCards,
  reportCardFiltersSchema,
} from "@/features/assessments";

export const GET = withPermission(
  "reports",
  "view",
  async (request, { user }) => {
    const { searchParams } = new URL(request.url);
    const validation = validateQuery(searchParams, reportCardFiltersSchema);

    if (!validation.success) {
      return validationErrorResponse(validation.errors!);
    }

    const result = await listReportCards(validation.data!, user);

    return successResponse(result.data, {
      page: result.page,
      pageSize: result.pageSize,
      total: result.total,
      totalPages: result.totalPages,
    });
  },
);

export const POST = withPermission(
  "reports",
  "create",
  async (request, { user }) => {
    const validation = await validateBody(request, generateReportCardSchema);

    if (!validation.success) {
      return validationErrorResponse(validation.errors!);
    }

    const result = await generateReportCard(validation.data!, user);

    if (!result.success) {
      return errorResponse(result.message);
    }

    return createdResponse(
      {
        reportId: result.reportId,
      },
      result.message,
    );
  },
);
