// app/api/discipline/[id]/route.ts
// GET single record, PUT update record

import { NextRequest } from "next/server";
import { withPermission } from "@/lib/api/withAuth";
import { validateBody } from "@/lib/api/validation";
import { apiSuccess, apiError } from "@/lib/api/response";
import { updateDisciplineSchema } from "@/features/discipline";
import {
  getDisciplinaryRecord,
  updateDisciplinaryRecord,
} from "@/features/discipline/services/discipline.service";

export const GET = withPermission(
  { module: "compliance", action: "view" },
  async (req: NextRequest, user, { params }: { params: { id: string } }) => {
    try {
      const result = await getDisciplinaryRecord(params.id, user.school_id);

      if (!result.success) {
        return apiError(result.message || "Record not found", 404);
      }

      return apiSuccess(result.data);
    } catch (error) {
      return apiError("Internal server error", 500);
    }
  },
);

export const PUT = withPermission(
  { module: "compliance", action: "edit" },
  async (req: NextRequest, user, { params }: { params: { id: string } }) => {
    try {
      const body = await req.json();
      const validation = validateBody(body, updateDisciplineSchema);

      if (!validation.success) {
        return apiError(validation.error, 422);
      }

      const result = await updateDisciplinaryRecord(
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
