export const dynamic = 'force-dynamic';
// app/api/settings/academic-years/[id]/route.ts
// PUT update academic year, DELETE remove academic year

import { NextRequest } from "next/server";
import { withPermission } from "@/lib/api/withAuth";
import { validateBody, validateUuid } from "@/lib/api/validation";
import { apiSuccess, apiError, validationErrorResponse } from "@/lib/api/response";
import { updateAcademicYearSchema } from "@/features/settings";
import {
  updateAcademicYear,
  deleteAcademicYear,
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
      const validation = validateBody(body, updateAcademicYearSchema);

      if (!validation.success) {
        return apiError(validation.error, 422);
      }

      const result = await updateAcademicYear(
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

      const result = await deleteAcademicYear(params.id, user.school_id);
      if (!result.success) {
        return apiError(result.message, 400);
      }

      return apiSuccess(null, result.message);
    } catch (error) {
      return apiError("Internal server error", 500);
    }
  },
);
