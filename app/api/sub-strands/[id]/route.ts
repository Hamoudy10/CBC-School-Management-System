import { withPermission } from "@/lib/api/withAuth";
import { validateBody, validateUuid } from "@/lib/api/validation";
import {
  errorResponse,
  notFoundResponse,
  successResponse,
  validationErrorResponse,
} from "@/lib/api/response";
import {
  getSubStrandById,
  updateSubStrand,
  deleteSubStrand,
  updateSubStrandSchema,
} from "@/features/academics";

export const GET = withPermission("academics", "view", async (_request, { user, params }) => {
  const id = params?.id;
  if (!id) {
    return notFoundResponse("Sub-strand ID required");
  }

  const validation = validateUuid(id);
  if (!validation.success) {
    return validationErrorResponse(validation.errors!);
  }

  const item = await getSubStrandById(id, user);
  if (!item) {
    return notFoundResponse("Sub-strand not found");
  }

  return successResponse(item);
});

export const PATCH = withPermission("academics", "update", async (request, { user, params }) => {
  const id = params?.id;
  if (!id) {
    return notFoundResponse("Sub-strand ID required");
  }

  const idValidation = validateUuid(id);
  if (!idValidation.success) {
    return validationErrorResponse(idValidation.errors!);
  }

  const validation = await validateBody(request, updateSubStrandSchema);
  if (!validation.success) {
    return validationErrorResponse(validation.errors!);
  }

  const result = await updateSubStrand(id, validation.data!, user);
  if (!result.success) {
    return errorResponse(result.message);
  }

  return successResponse({ subStrandId: id });
});

export const DELETE = withPermission("academics", "delete", async (_request, { user, params }) => {
  const id = params?.id;
  if (!id) {
    return notFoundResponse("Sub-strand ID required");
  }

  const validation = validateUuid(id);
  if (!validation.success) {
    return validationErrorResponse(validation.errors!);
  }

  const result = await deleteSubStrand(id, user);
  if (!result.success) {
    return errorResponse(result.message);
  }

  return successResponse({ subStrandId: id });
});