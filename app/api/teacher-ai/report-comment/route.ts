export const dynamic = "force-dynamic";

import { withPermission } from "@/lib/api/withAuth";
import { validateBody } from "@/lib/api/validation";
import {
  errorResponse,
  successResponse,
  validationErrorResponse,
} from "@/lib/api/response";
import {
  generateTeacherReportComment,
  reportCommentRequestSchema,
} from "@/features/teacher-ai";

export const POST = withPermission(
  "assessments",
  "view",
  async (request, { user }) => {
    const validation = await validateBody(request, reportCommentRequestSchema);
    if (!validation.success) {
      return validationErrorResponse(validation.errors!);
    }

    try {
      const result = await generateTeacherReportComment(validation.data!, user);
      return successResponse(result);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to generate report comment.";
      return errorResponse(message, 500);
    }
  },
);
