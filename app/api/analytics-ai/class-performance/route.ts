export const dynamic = "force-dynamic";

import { withPermission } from "@/lib/api/withAuth";
import { validateBody } from "@/lib/api/validation";
import {
  errorResponse,
  successResponse,
  validationErrorResponse,
} from "@/lib/api/response";
import {
  classPerformanceRequestSchema,
  generateClassPerformanceTrends,
} from "@/features/analytics-ai";

export const POST = withPermission("analytics", "view", async (request, { user }) => {
  const validation = await validateBody(request, classPerformanceRequestSchema);
  if (!validation.success) {
    return validationErrorResponse(validation.errors!);
  }

  try {
    const result = await generateClassPerformanceTrends(validation.data!, user);
    return successResponse(result);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to generate class performance trends.";
    return errorResponse(message, 500);
  }
});
