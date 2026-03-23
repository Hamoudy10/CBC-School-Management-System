import { withPermission } from "@/lib/api/withAuth";
import { validateBody, validateUuid } from "@/lib/api/validation";
import {
  errorResponse,
  notFoundResponse,
  successResponse,
  validationErrorResponse,
} from "@/lib/api/response";
import {
  getLearningAreaById,
  updateLearningArea,
  deleteLearningArea,
  updateLearningAreaSchema,
} from "@/features/academics";

export const GET = withPermission("academics", "view", async (_request, { user, params }) => {
  const id = params?.id;
  if (!id) {
    return notFoundResponse("Learning area ID required");
  }

  const validation = validateUuid(id);
  if (!validation.success) {
    return validationErrorResponse(validation.errors!);
  }

  const item = await getLearningAreaById(id, user);
  if (!item) {
    return notFoundResponse("Learning area not found");
  }

  return successResponse(item);
});

export const PATCH = withPermission("academics", "update", async (request, { user, params }) => {
  const id = params?.id;
  if (!id) {
    return notFoundResponse("Learning area ID required");
  }

  const idValidation = validateUuid(id);
  if (!idValidation.success) {
    return validationErrorResponse(idValidation.errors!);
  }

  const validation = await validateBody(request, updateLearningAreaSchema);
  if (!validation.success) {
    return validationErrorResponse(validation.errors!);
  }

  const result = await updateLearningArea(id, validation.data!, user);
  if (!result.success) {
    return errorResponse(result.message);
  }

  return successResponse({ learningAreaId: id });
});

export const DELETE = withPermission("academics", "delete", async (_request, { user, params }) => {
  const id = params?.id;
  if (!id) {
    return notFoundResponse("Learning area ID required");
  }

  const validation = validateUuid(id);
  if (!validation.success) {
    return validationErrorResponse(validation.errors!);
  }

  const result = await deleteLearningArea(id, user);
  if (!result.success) {
    return errorResponse(result.message);
  }

  return successResponse({ learningAreaId: id });
});
