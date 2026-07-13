import { NextRequest } from "next/server";
import { withPermission } from "@/lib/api/withAuth";
import { validateBody } from "@/lib/api/validation";
import { successResponse, errorResponse, validationErrorResponse } from "@/lib/api/response";
import { performanceForecastRequestSchema } from "@/features/predictive-analytics/validators/predictive-analytics.schema";
import { generatePerformanceForecast } from "@/features/predictive-analytics/services/performance-forecast.service";

export const POST = withPermission(
  { module: "analytics", action: "view" },
  async (request: NextRequest, { user }: any) => {
    if (!user.school_id) {
      return errorResponse("User account is not associated with a school. Contact administrator.", 400);
    }

    const validation = await validateBody(request, performanceForecastRequestSchema);
    if (!validation.success) {return validationErrorResponse(validation.errors!);}

    try {
      const result = await generatePerformanceForecast(validation.data, user.school_id);
      return successResponse(result);
    } catch (error) {
      return errorResponse(
        error instanceof Error ? error.message : "Failed to generate performance forecast",
        500
      );
    }
  }
);

