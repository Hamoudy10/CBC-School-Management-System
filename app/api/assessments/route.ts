export const dynamic = 'force-dynamic';

// app/api/assessments/route.ts
// ============================================================
// GET /api/assessments - List assessments or class competency roster
// POST /api/assessments - Create a single assessment
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
  assessmentFiltersSchema,
  createAssessment,
  createAssessmentSchema,
  listAssessments,
} from "@/features/assessments";

export const GET = withPermission(
  "assessments",
  "view",
  async (request, { user }) => {
    const { searchParams } = new URL(request.url);
    const validation = validateQuery(searchParams, assessmentFiltersSchema);

    if (!validation.success) {
      return validationErrorResponse(validation.errors!);
    }

    const result = await listAssessments(validation.data!, user);

    return successResponse(result.data, {
      page: result.page,
      pageSize: result.pageSize,
      total: result.count,
      totalPages: Math.max(1, Math.ceil(result.count / Math.max(1, result.pageSize))),
    });
  },
);

export const POST = withPermission(
  "assessments",
  "create",
  async (request, { user }) => {
    const validation = await validateBody(request, createAssessmentSchema);

    if (!validation.success) {
      return validationErrorResponse(validation.errors!);
    }

    const result = await createAssessment(validation.data!, user);

    if (!result.success) {
      return errorResponse(result.message);
    }

    return createdResponse(
      {
        assessmentId: result.assessmentId,
      },
      result.message,
    );
  },
);
