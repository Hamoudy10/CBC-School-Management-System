export const dynamic = "force-dynamic";

import { withPermission } from "@/lib/api/withAuth";
import {
  errorResponse,
  successResponse,
  validationErrorResponse,
} from "@/lib/api/response";
import { validateBody } from "@/lib/api/validation";
import {
  generateCbcLessonPlan,
  lessonPlanRequestSchema,
} from "@/features/ai-cbc-copilot";

export const POST = withPermission(
  "academics",
  "create",
  async (request, { user }) => {
    const validation = await validateBody(request, lessonPlanRequestSchema);
    if (!validation.success) {
      return validationErrorResponse(validation.errors!);
    }

    try {
      const result = await generateCbcLessonPlan(validation.data!, user);
      return successResponse(result);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to generate lesson plan.";
      return errorResponse(message, 500);
    }
  },
);
