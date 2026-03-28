// app/api/communication/messages/[id]/route.ts
// GET single message, DELETE soft-delete

import { NextRequest } from "next/server";
import { withPermission } from "@/lib/api/withAuth";
import { successResponse, errorResponse } from "@/lib/api/response";
import { deleteMessage, getMessageById } from "@/features/communication";

export const GET = withPermission(
  { module: "communication", action: "view" },
  async (
    req: NextRequest,
    { user, params }: { user: any; params: { id: string } },
  ) => {
    try {
      const result = await getMessageById(params.id, user.id, user.schoolId!);

      if (!result.success || !result.data) {
        return errorResponse(result.message || "Message not found", 404);
      }

      return successResponse(result.data);
    } catch (error: any) {
      return errorResponse(error.message, 500);
    }
  },
);

export const DELETE = withPermission(
  { module: "communication", action: "delete" },
  async (
    req: NextRequest,
    { user, params }: { user: any; params: { id: string } },
  ) => {
    try {
      const result = await deleteMessage(params.id, user.id, user.schoolId!);
      if (!result.success) {
        return errorResponse(result.message, 400);
      }
      return successResponse(result);
    } catch (error: any) {
      return errorResponse(error.message, 500);
    }
  },
);
