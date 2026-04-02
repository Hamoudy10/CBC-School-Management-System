import { withPermission } from "@/lib/api/withAuth";
import { validateBody, validateUuid } from "@/lib/api/validation";
import {
  errorResponse,
  notFoundResponse,
  successResponse,
  validationErrorResponse,
} from "@/lib/api/response";
import {
  getCompetencyById,
  updateCompetency,
  deleteCompetency,
  updateCompetencySchema,
} from "@/features/academics";

export const GET = withPermission("academics", "view", async (_request, { user, params }) => {
  const id = params?.id;
  if (!id) {
    return notFoundResponse("Competency ID required");
  }

  const validation = validateUuid(id);
  if (!validation.success) {
    return validationErrorResponse(validation.errors!);
  }

  const item = await getCompetencyById(id, user);
  if (!item) {
    return notFoundResponse("Competency not found");
  }

  return successResponse(item);
});

export const PATCH = withPermission("academics", "update", async (request, { user, params }) => {
  const id = params?.id;
  if (!id) {
    return notFoundResponse("Competency ID required");
  }

  const idValidation = validateUuid(id);
  if (!idValidation.success) {
    return validationErrorResponse(idValidation.errors!);
  }

  const validation = await validateBody(request, updateCompetencySchema);
  if (!validation.success) {
    return validationErrorResponse(validation.errors!);
  }

  const result = await updateCompetency(id, validation.data!, user);
  if (!result.success) {
    return errorResponse(result.message);
  }

  return successResponse({ competencyId: id });
});

export const DELETE = withPermission("academics", "delete", async (_request, { user, params }) => {
  const id = params?.id;
  if (!id) {
    return notFoundResponse("Competency ID required");
  }

  const validation = validateUuid(id);
  if (!validation.success) {
    return validationErrorResponse(validation.errors!);
  }

  const result = await deleteCompetency(id, user);
  if (!result.success) {
    return errorResponse(result.message);
  }

  return successResponse({ competencyId: id });
});