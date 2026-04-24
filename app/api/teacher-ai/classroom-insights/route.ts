export const dynamic = "force-dynamic";

import { withPermission } from "@/lib/api/withAuth";
import { validateBody } from "@/lib/api/validation";
import {
  errorResponse,
  successResponse,
  validationErrorResponse,
} from "@/lib/api/response";
import {
  classroomInsightsRequestSchema,
  generateClassroomInsights,
} from "@/features/teacher-ai";

export const POST = withPermission(
  "assessments",
  "view",
  async (request, { user }) => {
    const validation = await validateBody(request, classroomInsightsRequestSchema);
    if (!validation.success) {
      return validationErrorResponse(validation.errors!);
    }

    try {
      const result = await generateClassroomInsights(validation.data!, user);
      return successResponse(result);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to generate classroom insights.";
      return errorResponse(message, 500);
    }
  },
);
