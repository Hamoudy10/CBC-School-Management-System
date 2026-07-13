import { NextRequest } from "next/server";
import { withPermission } from "@/lib/api/withAuth";
import { validateBody } from "@/lib/api/validation";
import { successResponse, errorResponse, validationErrorResponse } from "@/lib/api/response";
import { interventionRecommendationRequestSchema } from "@/features/predictive-analytics/validators/predictive-analytics.schema";
import { generateInterventionRecommendations } from "@/features/predictive-analytics/services/intervention.service";

export const POST = withPermission(
  { module: "analytics", action: "view" },
  async (request: NextRequest, { user }: any) => {
    if (!user.school_id) {
      return errorResponse("User account is not associated with a school. Contact administrator.", 400);
    }

    const validation = await validateBody(request, interventionRecommendationRequestSchema);
    if (!validation.success) {return validationErrorResponse(validation.errors ?? {});}

    try {
      const result = await generateInterventionRecommendations(
        validation.data.classId,
        validation.data.minRiskLevel,
        user.school_id,
        validation.data.termId,
        validation.data.academicYearId
      );
      return successResponse(result);
    } catch (error) {
      return errorResponse(
        error instanceof Error ? error.message : "Failed to generate intervention recommendations",
        500
      );
    }
  }
);

