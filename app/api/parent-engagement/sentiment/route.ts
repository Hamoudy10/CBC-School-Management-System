import { NextRequest } from "next/server";
import { withPermission } from "@/lib/api/withAuth";
import { validateBody } from "@/lib/api/validation";
import { successResponse, errorResponse, validationErrorResponse } from "@/lib/api/response";
import { sentimentAnalysisRequestSchema } from "@/features/parent-engagement/validators/parent-engagement.schema";
import { analyzeParentSentiment } from "@/features/parent-engagement/services/sentiment-analysis.service";

export const POST = withPermission(
  { module: "communication", action: "view" },
  async (request: NextRequest, { user }: any) => {
    const validation = await validateBody(request, sentimentAnalysisRequestSchema);
    if (!validation.success) {return validationErrorResponse(validation.errors ?? {});}

    try {
      const result = await analyzeParentSentiment(
        validation.data.messages,
        user.school_id
      );
      return successResponse(result);
    } catch (error) {
      return errorResponse(
        error instanceof Error ? error.message : "Failed to analyze sentiment",
        500
      );
    }
  }
);

export async function GET() {
  return successResponse({
    description: "Parent Communication Sentiment Analysis",
    usage: "POST an array of messages to analyze sentiment patterns",
  });
}

