export const dynamic = "force-dynamic";

import { withPermission } from "@/lib/api/withAuth";
import { validateQuery } from "@/lib/api/validation";
import {
  errorResponse,
  successResponse,
  validationErrorResponse,
} from "@/lib/api/response";
import {
  classStudentsQuerySchema,
  listClassStudentsForTeacherAI,
} from "@/features/teacher-ai";

export const GET = withPermission(
  "assessments",
  "view",
  async (request, { user }) => {
    const { searchParams } = new URL(request.url);
    const validation = validateQuery(searchParams, classStudentsQuerySchema);
    if (!validation.success) {
      return validationErrorResponse(validation.errors!);
    }

    try {
      const students = await listClassStudentsForTeacherAI(validation.data!.classId, user);
      return successResponse(students);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Failed to load class students.";
      return errorResponse(message, 500);
    }
  },
);
