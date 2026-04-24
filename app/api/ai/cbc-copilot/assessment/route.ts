export const dynamic = "force-dynamic";

import { withPermission } from "@/lib/api/withAuth";
import {
  errorResponse,
  successResponse,
  validationErrorResponse,
} from "@/lib/api/response";
import { validateBody } from "@/lib/api/validation";
import {
  assessmentGeneratorRequestSchema,
  generateCbcAssessment,
} from "@/features/ai-cbc-copilot";

export const POST = withPermission(
  "academics",
  "create",
  async (request, { user }) => {
    const validation = await validateBody(request, assessmentGeneratorRequestSchema);
    if (!validation.success) {
      return validationErrorResponse(validation.errors!);
    }

    try {
      const result = await generateCbcAssessment(validation.data!, user);
      return successResponse(result);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to generate assessment.";
      return errorResponse(message, 500);
    }
  },
);
