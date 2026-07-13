import { NextRequest } from "next/server";
import { withPermission } from "@/lib/api/withAuth";
import { validateBody } from "@/lib/api/validation";
import { successResponse, errorResponse, validationErrorResponse } from "@/lib/api/response";
import { studentClusterRequestSchema } from "@/features/predictive-analytics/validators/predictive-analytics.schema";
import { generateStudentClusters } from "@/features/predictive-analytics/services/student-clustering.service";

export const POST = withPermission(
  { module: "analytics", action: "view" },
  async (request: NextRequest, context: any) => {
    const schoolId = context.school_id ?? context.user?.schoolId;
    if (!schoolId) {
      return errorResponse("User account is not associated with a school. Contact administrator.", 400);
    }

    const validation = await validateBody(request, studentClusterRequestSchema);
    if (!validation.success) {return validationErrorResponse(validation.errors ?? {});}

    try {
      const result = await generateStudentClusters(
        validation.data.classId,
        validation.data.clusterCount,
        schoolId,
        validation.data.termId,
        validation.data.academicYearId
      );
      return successResponse(result);
    } catch (error) {
      return errorResponse(
        error instanceof Error ? error.message : "Failed to generate student clusters",
        500
      );
    }
  }
);

