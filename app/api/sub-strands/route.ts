import { validateBody, validateQuery, validateUuid } from "@/lib/api/validation";
import {
  createdResponse,
  errorResponse,
  notFoundResponse,
  successResponse,
  validationErrorResponse,
} from "@/lib/api/response";
import { withPermission } from "@/lib/api/withAuth";
import {
  listSubStrands,
  getSubStrandById,
  createSubStrand,
  updateSubStrand,
  deleteSubStrand,
  createSubStrandSchema,
  updateSubStrandSchema,
} from "@/features/academics";
import { z } from "zod";

const subStrandListSchema = z.object({
  strandId: z.string().uuid(),
});

export const GET = withPermission("academics", "view", async (request, { user }) => {
  const { searchParams } = new URL(request.url);
  const validation = validateQuery(searchParams, subStrandListSchema);
  if (!validation.success) {
    return validationErrorResponse(validation.errors!);
  }

  const items = await listSubStrands(validation.data!.strandId, user);
  return successResponse(items);
});

export const POST = withPermission("academics", "create", async (request, { user }) => {
  const validation = await validateBody(request, createSubStrandSchema);
  if (!validation.success) {
    return validationErrorResponse(validation.errors!);
  }

  const result = await createSubStrand(validation.data!, user);
  if (!result.success) {
    return errorResponse(result.message);
  }

  return createdResponse({ subStrandId: result.id, message: result.message });
});

export const GET_BY_ID = withPermission("academics", "view", async (_request, { user, params }) => {
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

export const PATCH_BY_ID = withPermission("academics", "update", async (request, { user, params }) => {
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

export const DELETE_BY_ID = withPermission("academics", "delete", async (_request, { user, params }) => {
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
