import { withPermission } from "@/lib/api/withAuth";
import { validateBody, validateUuid } from "@/lib/api/validation";
import {
  errorResponse,
  notFoundResponse,
  successResponse,
  validationErrorResponse,
} from "@/lib/api/response";
import {
  getStrandById,
  updateStrand,
  deleteStrand,
  updateStrandSchema,
} from "@/features/academics";

export const GET = withPermission("academics", "view", async (_request, { user, params }) => {
  const id = params?.id;
  if (!id) {
    return notFoundResponse("Strand ID required");
  }

  const validation = validateUuid(id);
  if (!validation.success) {
    return validationErrorResponse(validation.errors!);
  }

  const item = await getStrandById(id, user);
  if (!item) {
    return notFoundResponse("Strand not found");
  }

  return successResponse(item);
});

export const PATCH = withPermission("academics", "update", async (request, { user, params }) => {
  const id = params?.id;
  if (!id) {
    return notFoundResponse("Strand ID required");
  }

  const idValidation = validateUuid(id);
  if (!idValidation.success) {
    return validationErrorResponse(idValidation.errors!);
  }

  const validation = await validateBody(request, updateStrandSchema);
  if (!validation.success) {
    return validationErrorResponse(validation.errors!);
  }

  const result = await updateStrand(id, validation.data!, user);
  if (!result.success) {
    return errorResponse(result.message);
  }

  return successResponse({ strandId: id });
});

export const DELETE = withPermission("academics", "delete", async (_request, { user, params }) => {
  const id = params?.id;
  if (!id) {
    return notFoundResponse("Strand ID required");
  }

  const validation = validateUuid(id);
  if (!validation.success) {
    return validationErrorResponse(validation.errors!);
  }

  const result = await deleteStrand(id, user);
  if (!result.success) {
    return errorResponse(result.message);
  }

  return successResponse({ strandId: id });
});