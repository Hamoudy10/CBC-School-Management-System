// app/api/learning-areas/[id]/hierarchy/route.ts
// ============================================================
// GET /api/learning-areas/:id/hierarchy - Get full CBC hierarchy
// ============================================================

import { NextRequest } from "next/server";
import { withPermission } from "@/lib/api/withAuth";
import { validateUuid } from "@/lib/api/validation";
import {
  successResponse,
  notFoundResponse,
  validationErrorResponse,
} from "@/lib/api/response";
import { getCBCHierarchy } from "@/features/academics";

// ============================================================
// GET Handler
// ============================================================
export const GET = withPermission(
  "academics",
  "view",
  async (request, { user, params }) => {
    const id = params?.id;
    if (!id) return notFoundResponse("Learning area ID required");

    const validation = validateUuid(id);
    if (!validation.success) {
      return validationErrorResponse(validation.errors!);
    }

    const hierarchy = await getCBCHierarchy(id, user);

    if (!hierarchy) {
      return notFoundResponse("Learning area not found");
    }

    return successResponse(hierarchy);
  },
);
