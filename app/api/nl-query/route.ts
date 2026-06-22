import { NextRequest } from "next/server";
import { withPermission } from "@/lib/api/withAuth";
import { validateBody } from "@/lib/api/validation";
import { successResponse, errorResponse, validationErrorResponse } from "@/lib/api/response";
import { nlQueryRequestSchema } from "@/features/nl-query/validators/nl-query.schema";
import { processNLQuery } from "@/features/nl-query/services/nl-query.service";

export const POST = withPermission(
  { module: "analytics", action: "view" },
  async (request: NextRequest, { user }: any) => {
    const validation = await validateBody(request, nlQueryRequestSchema);
    if (!validation.success) return validationErrorResponse(validation.errors ?? {});

    try {
      const result = await processNLQuery(
        validation.data,
        user.school_id,
        user.id
      );
      return successResponse(result);
    } catch (error) {
      return errorResponse(
        error instanceof Error ? error.message : "Failed to process query",
        500
      );
    }
  },
  "ai_generation"
);

export async function GET() {
  return successResponse({
    description: "Natural Language Query API for school data",
    usage: "POST a JSON body with { query: string, classId?: string, termId?: string, academicYearId?: string, studentId?: string, format?: string }",
    example: {
      query: "Show me the top 10 performing students in Mathematics",
      classId: "optional-uuid",
    },
  });
}
