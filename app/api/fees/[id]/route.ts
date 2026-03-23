import { withPermission } from "@/lib/api/withAuth";
import {
  errorResponse,
  notFoundResponse,
  successResponse,
  validationErrorResponse,
} from "@/lib/api/response";
import { validateBody } from "@/lib/api/validation";
import {
  deleteFeeStructure,
  getFeeStructureById,
  updateFeeStructure,
  updateFeeStructureSchema,
} from "@/features/finance";

export const GET = withPermission("finance", "view", async (_request, { user, params }) => {
  const fee = await getFeeStructureById(params.id, user);

  if (!fee) {
    return notFoundResponse("Fee structure not found");
  }

  return successResponse(fee);
});

export const PUT = withPermission("finance", "update", async (request, { user, params }) => {
  const validation = await validateBody(request, updateFeeStructureSchema);

  if (!validation.success) {
    return validationErrorResponse(validation.errors!);
  }

  const result = await updateFeeStructure(params.id, validation.data!, user);

  if (!result.success) {
    return errorResponse(result.message, 400);
  }

  return successResponse({ id: params.id }, 200);
});

export const DELETE = withPermission("finance", "delete", async (_request, { user, params }) => {
  const result = await deleteFeeStructure(params.id, user);

  if (!result.success) {
    return errorResponse(result.message, 400);
  }

  return successResponse({ id: params.id });
});
