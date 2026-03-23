// @ts-nocheck
// app/api/assessments/[id]/route.ts
// ============================================================
// GET /api/assessments/:id - Get assessment details
// PUT /api/assessments/:id - Update assessment
// DELETE /api/assessments/:id - Delete assessment
// ============================================================

import { withPermission } from "@/lib/api/withAuth";
import { validateBody, validateUuid } from "@/lib/api/validation";
import {
  successResponse,
  errorResponse,
  notFoundResponse,
  validationErrorResponse,
} from "@/lib/api/response";
import {
  getAssessmentById,
  updateAssessment,
  deleteAssessment,
  updateAssessmentSchema,
} from "@/features/assessments";

// ============================================================
// GET Handler - Get Assessment
// ============================================================
export const GET = withPermission(
  "assessments",
  "view",
  async (request, { user, params }) => {
    const id = params?.id;
    if (!id) {return notFoundResponse("Assessment ID required");}

    const validation = validateUuid(id);
    if (!validation.success) {
      return validationErrorResponse(validation.errors!);
    }

    const assessment = await getAssessmentById(id, user);

    if (!assessment) {
      return notFoundResponse("Assessment not found");
    }

    return successResponse(assessment);
  },
);

// ============================================================
// PUT Handler - Update Assessment
// ============================================================
export const PUT = withPermission(
  "assessments",
  "update",
  async (request, { user, params }) => {
    const id = params?.id;
    if (!id) {return notFoundResponse("Assessment ID required");}

    const idValidation = validateUuid(id);
    if (!idValidation.success) {
      return validationErrorResponse(idValidation.errors!);
    }

    const bodyValidation = await validateBody(request, updateAssessmentSchema);
    if (!bodyValidation.success) {
      return validationErrorResponse(bodyValidation.errors!);
    }

    const result = await updateAssessment(id, bodyValidation.data!, user);

    if (!result.success) {
      return errorResponse(result.message);
    }

    return successResponse({ message: result.message });
  },
);

// ============================================================
// DELETE Handler - Delete Assessment
// ============================================================
export const DELETE = withPermission(
  "assessments",
  "delete",
  async (request, { user, params }) => {
    const id = params?.id;
    if (!id) {return notFoundResponse("Assessment ID required");}

    const validation = validateUuid(id);
    if (!validation.success) {
      return validationErrorResponse(validation.errors!);
    }

    const result = await deleteAssessment(id, user);

    if (!result.success) {
      return errorResponse(result.message);
    }

    return successResponse({ message: result.message });
  },
);
