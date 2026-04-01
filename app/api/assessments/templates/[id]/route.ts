// app/api/assessments/templates/[id]/route.ts
// ============================================================
// GET /api/assessments/templates/:id - Get template details
// PUT /api/assessments/templates/:id - Update template
// DELETE /api/assessments/templates/:id - Deactivate template
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
  getAssessmentTemplateById,
  updateAssessmentTemplate,
  deleteAssessmentTemplate,
  updateAssessmentTemplateSchema,
} from "@/features/assessments";

export const GET = withPermission(
  "assessments",
  "view",
  async (request, { user, params }) => {
    const id = params?.id;
    if (!id) {
      return notFoundResponse("Template ID required");
    }

    const validation = validateUuid(id);
    if (!validation.success) {
      return validationErrorResponse(validation.errors!);
    }

    const template = await getAssessmentTemplateById(id, user);

    if (!template) {
      return notFoundResponse("Assessment template not found");
    }

    return successResponse(template);
  },
);

export const PUT = withPermission(
  "assessments",
  "update",
  async (request, { user, params }) => {
    const id = params?.id;
    if (!id) {
      return notFoundResponse("Template ID required");
    }

    const idValidation = validateUuid(id);
    if (!idValidation.success) {
      return validationErrorResponse(idValidation.errors!);
    }

    const bodyValidation = await validateBody(request, updateAssessmentTemplateSchema);
    if (!bodyValidation.success) {
      return validationErrorResponse(bodyValidation.errors!);
    }

    const result = await updateAssessmentTemplate(id, bodyValidation.data!, user);

    if (!result.success) {
      return errorResponse(result.message);
    }

    return successResponse({ message: result.message });
  },
);

export const DELETE = withPermission(
  "assessments",
  "delete",
  async (request, { user, params }) => {
    const id = params?.id;
    if (!id) {
      return notFoundResponse("Template ID required");
    }

    const validation = validateUuid(id);
    if (!validation.success) {
      return validationErrorResponse(validation.errors!);
    }

    const result = await deleteAssessmentTemplate(id, user);

    if (!result.success) {
      return errorResponse(result.message);
    }

    return successResponse({ message: result.message });
  },
);
