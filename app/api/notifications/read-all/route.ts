// app/api/notifications/read-all/route.ts
// POST mark all notifications as read

import { NextRequest } from "next/server";
import { withAuth } from "@/lib/api/withAuth";
import { apiSuccess, apiError } from "@/lib/api/response";
import { markAllNotificationsAsRead } from "@/features/communication/services/notifications.service";

export const POST = withAuth(async (req: NextRequest, user) => {
  try {
    const result = await markAllNotificationsAsRead(user.id, user.school_id);

    if (!result.success) {
      return apiError(result.message, 400);
    }

    return apiSuccess(null, result.message);
  } catch (error) {
    return apiError("Internal server error", 500);
  }
});
