// app/api/communication/broadcast/route.ts
// POST broadcast message to roles/classes

import { NextRequest } from "next/server";
import { withPermission } from "@/lib/api/withAuth";
import { successResponse, errorResponse } from "@/lib/api/response";
import { MessagesService } from "@/features/communication";
import { broadcastSchema } from "@/features/communication";

export const POST = withPermission(
  "communication",
  "create",
  async (req: NextRequest, user: any) => {
    try {
      const body = await req.json();
      const validated = broadcastSchema.parse(body);
      const result = await MessagesService.broadcastMessage(
        user.school_id,
        user.id,
        validated,
      );

      if (!result.success) return errorResponse(result.message, 400);
      return successResponse(result, 201);
    } catch (error: any) {
      if (error.name === "ZodError") return errorResponse(error.errors, 422);
      return errorResponse(error.message, 500);
    }
  },
);
