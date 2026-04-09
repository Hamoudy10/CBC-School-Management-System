export const dynamic = 'force-dynamic';

// app/api/special-needs/route.ts
// ============================================================
// GET /api/special-needs - List special needs records
// POST /api/special-needs - Create special needs record
// ============================================================

import { withPermission } from "@/lib/api/withAuth";
import { validateBody, validateQuery } from "@/lib/api/validation";
import {
  successResponse,
  errorResponse,
  createdResponse,
  validationErrorResponse,
} from "@/lib/api/response";
import {
  listSpecialNeeds,
  createSpecialNeed,
  specialNeedFiltersSchema,
  createSpecialNeedSchema,
} from "@/features/special-needs";

export const GET = withPermission(
  "special_needs",
  "view",
  async (request, { user }) => {
    const { searchParams } = new URL(request.url);
    const validation = validateQuery(searchParams, specialNeedFiltersSchema);

    if (!validation.success) {
      return validationErrorResponse(validation.errors!);
    }

    const result = await listSpecialNeeds(validation.data!, user);

    return successResponse(result.data, {
      page: result.page,
      pageSize: result.pageSize,
      total: result.total,
      totalPages: result.totalPages,
    });
  },
);

export const POST = withPermission(
  "special_needs",
  "create",
  async (request, { user }) => {
    const validation = await validateBody(request, createSpecialNeedSchema);

    if (!validation.success) {
      return validationErrorResponse(validation.errors!);
    }

    const result = await createSpecialNeed(validation.data!, user);

    if (!result.success) {
      return errorResponse(result.message);
    }

    return createdResponse(
      { specialNeedsId: result.specialNeedsId },
      result.message,
    );
  },
);
