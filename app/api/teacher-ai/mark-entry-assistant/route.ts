export const dynamic = "force-dynamic";

import { withPermission } from "@/lib/api/withAuth";
import { validateBody } from "@/lib/api/validation";
import {
  errorResponse,
  successResponse,
  validationErrorResponse,
} from "@/lib/api/response";
import {
  generateMarkEntrySuggestion,
  markEntryAssistantRequestSchema,
} from "@/features/teacher-ai";

export const POST = withPermission(
  "assessments",
  "create",
  async (request, { user }) => {
    const validation = await validateBody(request, markEntryAssistantRequestSchema);
    if (!validation.success) {
      return validationErrorResponse(validation.errors!);
    }

    try {
      const result = await generateMarkEntrySuggestion(validation.data!, user);
      return successResponse(result);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to generate mark suggestion.";
      return errorResponse(message, 500);
    }
  },
);
