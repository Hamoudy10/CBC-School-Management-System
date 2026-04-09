export const dynamic = 'force-dynamic';

// app/api/assessments/templates/route.ts
// ============================================================
// GET /api/assessments/templates - List assessment templates
// POST /api/assessments/templates - Create assessment template
// ============================================================

import { withPermission } from "@/lib/api/withAuth";
import { validateBody, validateQuery } from "@/lib/api/validation";
import {
  successResponse,
  errorResponse,
  createdResponse,
  validationErrorResponse,
} from "@/lib/api/response";
import {
  listAssessmentTemplates,
  createAssessmentTemplate,
  createAssessmentTemplateSchema,
  assessmentFiltersSchema,
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

    const result = await listAssessmentTemplates(
      {
        competencyId: validation.data?.competencyId,
        learningAreaId: validation.data?.learningAreaId,
        page: validation.data?.page,
        pageSize: validation.data?.pageSize,
      },
      user,
    );

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
    const validation = await validateBody(request, createAssessmentTemplateSchema);

    if (!validation.success) {
      return validationErrorResponse(validation.errors!);
    }

    const result = await createAssessmentTemplate(validation.data!, user);

    if (!result.success) {
      return errorResponse(result.message);
    }

    return createdResponse(
      { templateId: result.templateId },
      result.message,
    );
  },
);
