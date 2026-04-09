export const dynamic = 'force-dynamic';

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