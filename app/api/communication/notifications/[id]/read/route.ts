// app/api/communication/notifications/[id]/read/route.ts
// PUT mark notification as read

import { NextRequest } from "next/server";
import { withAuth } from "@/lib/api/withAuth";
import { successResponse, errorResponse } from "@/lib/api/response";
import { NotificationsService } from "@/features/communication";

export const PUT = withAuth(
  async (
    req: NextRequest,
    user: any,
    { params }: { params: { id: string } },
  ) => {
    try {
      const result = await NotificationsService.markAsRead(
        user.school_id,
        params.id,
        user.id,
      );
      return successResponse(result);
    } catch (error: any) {
      return errorResponse(error.message, 500);
    }
  },
);
