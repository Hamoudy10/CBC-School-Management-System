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
  listStrands,
  getStrandById,
  createStrand,
  updateStrand,
  deleteStrand,
  createStrandSchema,
  updateStrandSchema,
} from "@/features/academics";
import { z } from "zod";

const strandListSchema = z.object({
  learningAreaId: z.string().uuid(),
});

export const GET = withPermission("academics", "view", async (request, { user }) => {
  const { searchParams } = new URL(request.url);
  const validation = validateQuery(searchParams, strandListSchema);
  if (!validation.success) {
    return validationErrorResponse(validation.errors!);
  }

  const items = await listStrands(validation.data!.learningAreaId, user);
  return successResponse(items);
});

export const POST = withPermission("academics", "create", async (request, { user }) => {
  const validation = await validateBody(request, createStrandSchema);
  if (!validation.success) {
    return validationErrorResponse(validation.errors!);
  }

  const result = await createStrand(validation.data!, user);
  if (!result.success) {
    return errorResponse(result.message);
  }

  return createdResponse({ strandId: result.id, message: result.message });
});

export const GET_BY_ID = withPermission("academics", "view", async (_request, { user, params }) => {
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

export const PATCH_BY_ID = withPermission("academics", "update", async (request, { user, params }) => {
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

export const DELETE_BY_ID = withPermission("academics", "delete", async (_request, { user, params }) => {
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
