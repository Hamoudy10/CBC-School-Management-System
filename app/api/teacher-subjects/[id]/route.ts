import { withPermission } from "@/lib/api/withAuth";
import { validateUuid } from "@/lib/api/validation";
import {
  errorResponse,
  notFoundResponse,
  successResponse,
  validationErrorResponse,
} from "@/lib/api/response";
import { deactivateTeacherSubject } from "@/features/academics";

export const DELETE = withPermission("academics", "update", async (_request, { user, params }) => {
  const id = params?.id;
  if (!id) {
    return notFoundResponse("Assignment ID required");
  }

  const validation = validateUuid(id);
  if (!validation.success) {
    return validationErrorResponse(validation.errors!);
  }

  const result = await deactivateTeacherSubject(id, user);
  if (!result.success) {
    return errorResponse(result.message);
  }

  return successResponse({ assignmentId: id });
});