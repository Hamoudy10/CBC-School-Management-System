import { NextRequest } from "next/server";
import { withPermission } from "@/lib/api/withAuth";
import { validateBody } from "@/lib/api/validation";
import { successResponse, errorResponse, validationErrorResponse } from "@/lib/api/response";
import { subjectRecommendationRequestSchema } from "@/features/predictive-analytics/validators/predictive-analytics.schema";
import { generateSubjectRecommendation } from "@/features/predictive-analytics/services/subject-recommendation.service";

export const POST = withPermission(
  { module: "analytics", action: "view" },
  async (request: NextRequest, { user }: any) => {
    const validation = await validateBody(request, subjectRecommendationRequestSchema);
    if (!validation.success) return validationErrorResponse(validation.errors);

    try {
      const result = await generateSubjectRecommendation(
        validation.data.studentId,
        validation.data.classId,
        validation.data.includeCareerPaths,
        user.school_id
      );
      return successResponse(result);
    } catch (error) {
      return errorResponse(
        error instanceof Error ? error.message : "Failed to generate subject recommendations",
        500
      );
    }
  },
  "ai_generation"
);
