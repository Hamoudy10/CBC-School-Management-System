// app/api/settings/classes/sections/[id]/route.ts
// PUT/DELETE class section

import { NextRequest } from "next/server";
import { withPermission } from "@/lib/api/withAuth";
import { successResponse, errorResponse } from "@/lib/api/response";
import { updateClassSchema } from "@/features/settings";
import {
  deleteClass,
  updateClass,
} from "@/features/settings/services/classes.service";

export const PUT = withPermission(
  "settings",
  "edit",
  async (
    req: NextRequest,
    user: any,
    { params }: { params: { id: string } },
    ) => {
    try {
      const body = await req.json();
      const validated = updateClassSchema.parse(body);
      const result = await updateClass(
        params.id,
        validated,
        user.school_id,
      );
      if (!result.success) return errorResponse(result.message, 400);
      return successResponse(result);
    } catch (error: any) {
      return errorResponse(error.message, 500);
    }
  },
);

export const DELETE = withPermission(
  "settings",
  "delete",
  async (
    req: NextRequest,
    user: any,
    { params }: { params: { id: string } },
  ) => {
    try {
      const result = await deleteClass(
        params.id,
        user.school_id,
      );
      if (!result.success) return errorResponse(result.message, 400);
      return successResponse(result);
    } catch (error: any) {
      return errorResponse(error.message, 500);
    }
  },
);
