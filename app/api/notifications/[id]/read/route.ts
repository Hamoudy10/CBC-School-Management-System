// app/api/notifications/[id]/read/route.ts
// PUT mark notification as read

import { NextRequest } from "next/server";
import { withAuth } from "@/lib/api/withAuth";
import { apiSuccess, apiError } from "@/lib/api/response";
import { markNotificationAsRead } from "@/features/communication/services/notifications.service";

export const PUT = withAuth(
  async (req: NextRequest, user, { params }: { params: { id: string } }) => {
    try {
      const result = await markNotificationAsRead(
        params.id,
        user.id,
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
