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