export const dynamic = "force-dynamic";

import { withPermission } from "@/lib/api/withAuth";
import { validateBody } from "@/lib/api/validation";
import {
  errorResponse,
  successResponse,
  validationErrorResponse,
} from "@/lib/api/response";
import {
  schoolHealthRequestSchema,
  generateSchoolHealthDashboard,
} from "@/features/analytics-ai";

export const POST = withPermission("analytics", "view", async (request, { user }) => {
  const validation = await validateBody(request, schoolHealthRequestSchema);
  if (!validation.success) {
    return validationErrorResponse(validation.errors!);
  }

  try {
    const result = await generateSchoolHealthDashboard(validation.data!, user);
    return successResponse(result);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to generate school health dashboard.";
    return errorResponse(message, 500);
  }
});
