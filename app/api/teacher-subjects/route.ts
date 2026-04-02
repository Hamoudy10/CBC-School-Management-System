import { withPermission } from "@/lib/api/withAuth";
import { validateBody, validateQuery } from "@/lib/api/validation";
import {
  createdResponse,
  errorResponse,
  successResponse,
  validationErrorResponse,
} from "@/lib/api/response";
import {
  listTeacherSubjects,
  createTeacherSubject,
  teacherSubjectFiltersSchema,
  createTeacherSubjectSchema,
} from "@/features/academics";

export const GET = withPermission("academics", "view", async (request, { user }) => {
  const { searchParams } = new URL(request.url);
  const validation = validateQuery(searchParams, teacherSubjectFiltersSchema);
  if (!validation.success) {
    return validationErrorResponse(validation.errors!);
  }

  const result = await listTeacherSubjects(validation.data!, user);
  return successResponse(result.data, {
    page: result.page,
    pageSize: result.pageSize,
    total: result.total,
    totalPages: result.totalPages,
  });
});

export const POST = withPermission("academics", "create", async (request, { user }) => {
  const validation = await validateBody(request, createTeacherSubjectSchema);
  if (!validation.success) {
    return validationErrorResponse(validation.errors!);
  }

  const result = await createTeacherSubject(validation.data!, user);
  if (!result.success) {
    return errorResponse(result.message);
  }

  return createdResponse({ assignmentId: result.id, message: result.message });
});