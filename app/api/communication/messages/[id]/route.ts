// app/api/communication/messages/[id]/route.ts
// GET single message, DELETE soft-delete

import { NextRequest } from "next/server";
import { withAuth } from "@/lib/api/withAuth";
import { successResponse, errorResponse } from "@/lib/api/response";
import { MessagesService } from "@/features/communication";

export const GET = withAuth(
  async (
    req: NextRequest,
    user: any,
    { params }: { params: { id: string } },
  ) => {
    try {
      const message = await MessagesService.getMessage(
        user.school_id,
        params.id,
        user.id,
      );
      if (!message) return errorResponse("Message not found", 404);
      return successResponse(message);
    } catch (error: any) {
      return errorResponse(error.message, 500);
    }
  },
);

export const DELETE = withAuth(
  async (
    req: NextRequest,
    user: any,
    { params }: { params: { id: string } },
  ) => {
    try {
      const result = await MessagesService.deleteMessage(
        user.school_id,
        params.id,
        user.id,
      );
      if (!result.success) return errorResponse(result.message, 400);
      return successResponse(result);
    } catch (error: any) {
      return errorResponse(error.message, 500);
    }
  },
);
