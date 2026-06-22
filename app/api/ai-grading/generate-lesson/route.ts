import { NextRequest } from "next/server";
import { withPermission } from "@/lib/api/withAuth";
import { validateBody } from "@/lib/api/validation";
import { successResponse, errorResponse, validationErrorResponse } from "@/lib/api/response";
import { lessonPlanRequestSchema } from "@/features/ai-grading/validators/ai-grading.schema";
import { generateLessonPlan } from "@/features/ai-grading/services/lesson-generator.service";

export const POST = withPermission(
  { module: "academics", action: "create" },
  async (request: NextRequest, { user }: any) => {
    const validation = await validateBody(request, lessonPlanRequestSchema);
    if (!validation.success) return validationErrorResponse(validation.errors ?? {});

    try {
      const result = await generateLessonPlan(validation.data, user.school_id);
      return successResponse(result);
    } catch (error) {
      return errorResponse(
        error instanceof Error ? error.message : "Failed to generate lesson plan",
        500
      );
    }
  },
);

export async function GET() {
  return successResponse({
    description: "AI Lesson Plan Generator",
    usage: "POST classId, learningAreaId, and optional parameters to generate a CBC-aligned lesson plan",
  });
}
