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
  listCompetencies,
  getCompetencyById,
  createCompetency,
  updateCompetency,
  deleteCompetency,
  createCompetencySchema,
  updateCompetencySchema,
} from "@/features/academics";
import { z } from "zod";

const competencyListSchema = z.object({
  subStrandId: z.string().uuid(),
});

export const GET = withPermission("academics", "view", async (request, { user }) => {
  const { searchParams } = new URL(request.url);
  const validation = validateQuery(searchParams, competencyListSchema);
  if (!validation.success) {
    return validationErrorResponse(validation.errors!);
  }

  const items = await listCompetencies(validation.data!.subStrandId, user);
  return successResponse(items);
});

export const POST = withPermission("academics", "create", async (request, { user }) => {
  const validation = await validateBody(request, createCompetencySchema);
  if (!validation.success) {
    return validationErrorResponse(validation.errors!);
  }

  const result = await createCompetency(validation.data!, user);
  if (!result.success) {
    return errorResponse(result.message);
  }

  return createdResponse({ competencyId: result.id, message: result.message });
});

export const GET_BY_ID = withPermission("academics", "view", async (_request, { user, params }) => {
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

export const PATCH_BY_ID = withPermission("academics", "update", async (request, { user, params }) => {
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

export const DELETE_BY_ID = withPermission("academics", "delete", async (_request, { user, params }) => {
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
