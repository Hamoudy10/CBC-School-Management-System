import { NextRequest } from "next/server";
import { withPermission } from "@/lib/api/withAuth";
import { validateBody } from "@/lib/api/validation";
import { successResponse, errorResponse, validationErrorResponse } from "@/lib/api/response";
import { gradingRequestSchema } from "@/features/ai-grading/validators/ai-grading.schema";
import { gradeStudentResponses } from "@/features/ai-grading/services/ai-grading.service";

export const POST = withPermission(
  { module: "assessments", action: "create" },
  async (request: NextRequest, { user }: any) => {
    const validation = await validateBody(request, gradingRequestSchema);
    if (!validation.success) return validationErrorResponse(validation.errors ?? {});

    try {
      const result = await gradeStudentResponses(validation.data, user.school_id);
      return successResponse(result);
    } catch (error) {
      return errorResponse(
        error instanceof Error ? error.message : "Failed to grade responses",
        500
      );
    }
  },
  "ai_generation"
);

export async function GET() {
  return successResponse({
    description: "AI Auto-Grading API",
    usage: "POST questions, student responses, and optional marking scheme to get AI-graded results",
  });
}
