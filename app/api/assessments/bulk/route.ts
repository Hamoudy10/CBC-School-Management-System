// @ts-nocheck
// app/api/assessments/bulk/route.ts
// ============================================================
// POST /api/assessments/bulk - Bulk create/update assessments
// ============================================================

import { withPermission } from "@/lib/api/withAuth";
import { validateBody } from "@/lib/api/validation";
import {
  successResponse,
  errorResponse,
  validationErrorResponse,
} from "@/lib/api/response";
import {
  bulkCreateAssessments,
  bulkAssessmentSchema,
} from "@/features/assessments";

// ============================================================
// POST Handler - Bulk Create/Update Assessments
// ============================================================
export const POST = withPermission(
  "assessments",
  "create",
  async (request, { user }) => {
    const validation = await validateBody(request, bulkAssessmentSchema);
    if (!validation.success) {
      return validationErrorResponse(validation.errors!);
    }

    const result = await bulkCreateAssessments(validation.data!, user);

    if (!result.success) {
      return errorResponse(result.message);
    }

    return successResponse({
      message: result.message,
      created: result.created,
      updated: result.updated,
      failed: result.failed,
    });
  },
);
