import { withPermission } from "@/lib/api/withAuth";
import { validateUuid } from "@/lib/api/validation";
import {
  errorResponse,
  successResponse,
  validationErrorResponse,
} from "@/lib/api/response";
import {
  publishReportCard,
  unpublishReportCard,
} from "@/features/assessments";

export const POST = withPermission(
  "reports",
  "publish",
  async (_request, { user, params }) => {
    const id = params?.id;
    if (!id) {
      return errorResponse("Report card ID required", 400);
    }

    const validation = validateUuid(id);
    if (!validation.success) {
      return validationErrorResponse(validation.errors!);
    }

    const result = await publishReportCard(id, user);
    if (!result.success) {
      return errorResponse(result.message, 400);
    }

    return successResponse({ message: result.message });
  },
);

export const DELETE = withPermission(
  "reports",
  "publish",
  async (_request, { user, params }) => {
    const id = params?.id;
    if (!id) {
      return errorResponse("Report card ID required", 400);
    }

    const validation = validateUuid(id);
    if (!validation.success) {
      return validationErrorResponse(validation.errors!);
    }

    const result = await unpublishReportCard(id, user);
    if (!result.success) {
      return errorResponse(result.message, 400);
    }

    return successResponse({ message: result.message });
  },
);
