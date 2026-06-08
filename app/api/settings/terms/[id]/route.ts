export const dynamic = 'force-dynamic';
// app/api/settings/terms/[id]/route.ts
// PUT update term, DELETE remove term

import { NextRequest } from "next/server";
import { withPermission } from "@/lib/api/withAuth";
import { validateBody, validateUuid } from "@/lib/api/validation";
import { apiSuccess, apiError, validationErrorResponse } from "@/lib/api/response";
import { updateTermSchema } from "@/features/settings";
import {
  updateTerm,
  deleteTerm,
} from "@/features/settings/services/academicYear.service";

export const PUT = withPermission(
  { module: "settings", action: "edit" },
  async (req: NextRequest, user, { params }: { params: { id: string } }) => {
    try {
      const uuidValidation = validateUuid(params.id);
      if (!uuidValidation.success) {
        return validationErrorResponse(uuidValidation.errors!);
      }

      const body = await req.json();
      const validation = validateBody(body, updateTermSchema);

      if (!validation.success) {
        return apiError(validation.error, 422);
      }

      const result = await updateTerm(
        params.id,
        validation.data,
        user.school_id,
      );

      if (!result.success) {
        return apiError(result.message, 400);
      }

      return apiSuccess(null, result.message);
    } catch (error) {
      return apiError("Internal server error", 500);
    }
  },
);

export const DELETE = withPermission(
  { module: "settings", action: "delete" },
  async (req: NextRequest, user, { params }: { params: { id: string } }) => {
    try {
      const uuidValidation = validateUuid(params.id);
      if (!uuidValidation.success) {
        return validationErrorResponse(uuidValidation.errors!);
      }

      const result = await deleteTerm(params.id, user.school_id);
      if (!result.success) {
        return apiError(result.message, 400);
      }

      return apiSuccess(null, result.message);
    } catch (error) {
      return apiError("Internal server error", 500);
    }
  },
);
