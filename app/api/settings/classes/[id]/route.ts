// app/api/settings/classes/[id]/route.ts
// GET class detail, PUT update, DELETE deactivate

import { NextRequest } from "next/server";
import { withAuth, withPermission } from "@/lib/api/withAuth";
import { validateBody } from "@/lib/api/validation";
import { apiSuccess, apiError } from "@/lib/api/response";
import { updateClassSchema } from "@/features/settings";
import {
  getClassById,
  updateClass,
  deleteClass,
} from "@/features/settings/services/classes.service";

export const GET = withAuth(
  async (req: NextRequest, user, { params }: { params: { id: string } }) => {
    try {
      const result = await getClassById(params.id, user.school_id);

      if (!result.success) {
        return apiError(result.message || "Class not found", 404);
      }

      return apiSuccess(result.data);
    } catch (error) {
      return apiError("Internal server error", 500);
    }
  },
);

export const PUT = withPermission(
  { module: "settings", action: "edit" },
  async (req: NextRequest, user, { params }: { params: { id: string } }) => {
    try {
      const body = await req.json();
      const validation = validateBody(body, updateClassSchema);

      if (!validation.success) {
        return apiError(validation.error, 422);
      }

      const result = await updateClass(
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
      const result = await deleteClass(params.id, user.school_id);

      if (!result.success) {
        return apiError(result.message, 400);
      }

      return apiSuccess(null, result.message);
    } catch (error) {
      return apiError("Internal server error", 500);
    }
  },
);
