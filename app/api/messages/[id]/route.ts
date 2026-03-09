// app/api/messages/[id]/route.ts
// GET single message, DELETE (soft) message

import { NextRequest } from "next/server";
import { withPermission } from "@/lib/api/withAuth";
import { apiSuccess, apiError } from "@/lib/api/response";
import {
  getMessageById,
  deleteMessage,
} from "@/features/communication/services/messages.service";

export const GET = withPermission(
  { module: "communication", action: "view" },
  async (req: NextRequest, user, { params }: { params: { id: string } }) => {
    try {
      const result = await getMessageById(params.id, user.id, user.school_id);

      if (!result.success) {
        return apiError(result.message || "Message not found", 404);
      }

      return apiSuccess(result.data);
    } catch (error) {
      return apiError("Internal server error", 500);
    }
  },
);

export const DELETE = withPermission(
  { module: "communication", action: "delete" },
  async (req: NextRequest, user, { params }: { params: { id: string } }) => {
    try {
      const result = await deleteMessage(params.id, user.id, user.school_id);

      if (!result.success) {
        return apiError(result.message, 400);
      }

      return apiSuccess(null, result.message);
    } catch (error) {
      return apiError("Internal server error", 500);
    }
  },
);
