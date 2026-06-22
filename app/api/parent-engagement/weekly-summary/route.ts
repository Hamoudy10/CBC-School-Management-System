import { NextRequest } from "next/server";
import { withPermission } from "@/lib/api/withAuth";
import { validateBody } from "@/lib/api/validation";
import { successResponse, errorResponse, validationErrorResponse } from "@/lib/api/response";
import { weeklySummaryRequestSchema } from "@/features/parent-engagement/validators/parent-engagement.schema";
import { generateWeeklySummary } from "@/features/parent-engagement/services/weekly-summary.service";

export const POST = withPermission(
  { module: "communication", action: "view" },
  async (request: NextRequest, { user }: any) => {
    const validation = await validateBody(request, weeklySummaryRequestSchema);
    if (!validation.success) return validationErrorResponse(validation.errors ?? {});

    try {
      const result = await generateWeeklySummary(
        validation.data.studentId,
        validation.data.language,
        user.school_id,
        validation.data.termId,
        validation.data.academicYearId
      );
      return successResponse(result);
    } catch (error) {
      return errorResponse(
        error instanceof Error ? error.message : "Failed to generate weekly summary",
        500
      );
    }
  }
);

export async function GET() {
  return successResponse({
    description: "AI Weekly Parent Summary Generator",
    usage: "POST studentId to get a personalized weekly progress summary for parents",
  });
}

