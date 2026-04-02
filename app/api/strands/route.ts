import { validateBody, validateQuery, validateUuid } from "@/lib/api/validation";
import {
  createdResponse,
  errorResponse,
  successResponse,
  validationErrorResponse,
} from "@/lib/api/response";
import { withPermission } from "@/lib/api/withAuth";
import {
  listStrands,
  createStrand,
  createStrandSchema,
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