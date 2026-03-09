// app/api/learning-areas/route.ts
// ============================================================
// GET /api/learning-areas - List learning areas
// POST /api/learning-areas - Create learning area
// ============================================================

import { NextRequest } from "next/server";
import { withPermission } from "@/lib/api/withAuth";
import { validateBody, validateQuery } from "@/lib/api/validation";
import {
  successResponse,
  createdResponse,
  errorResponse,
  validationErrorResponse,
} from "@/lib/api/response";
import {
  listLearningAreas,
  createLearningArea,
  learningAreaFiltersSchema,
  createLearningAreaSchema,
} from "@/features/academics";

// ============================================================
// GET Handler
// ============================================================
export const GET = withPermission(
  "academics",
  "view",
  async (request, { user }) => {
    const { searchParams } = new URL(request.url);

    const validation = validateQuery(searchParams, learningAreaFiltersSchema);
    if (!validation.success) {
      return validationErrorResponse(validation.errors!);
    }

    const result = await listLearningAreas(validation.data!, user);

    return successResponse(result.data, {
      page: result.page,
      pageSize: result.pageSize,
      total: result.total,
      totalPages: result.totalPages,
    });
  },
);

// ============================================================
// POST Handler
// ============================================================
export const POST = withPermission(
  "academics",
  "create",
  async (request, { user }) => {
    const validation = await validateBody(request, createLearningAreaSchema);
    if (!validation.success) {
      return validationErrorResponse(validation.errors!);
    }

    const result = await createLearningArea(validation.data!, user);

    if (!result.success) {
      return errorResponse(result.message);
    }

    return createdResponse({
      learningAreaId: result.id,
      message: result.message,
    });
  },
);
