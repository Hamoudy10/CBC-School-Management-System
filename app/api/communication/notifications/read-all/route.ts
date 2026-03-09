// app/api/communication/notifications/read-all/route.ts
// PUT mark all notifications as read

import { NextRequest } from "next/server";
import { withAuth } from "@/lib/api/withAuth";
import { successResponse, errorResponse } from "@/lib/api/response";
import { NotificationsService } from "@/features/communication";

export const PUT = withAuth(async (req: NextRequest, user: any) => {
  try {
    const result = await NotificationsService.markAllAsRead(
      user.school_id,
      user.id,
    );
    return successResponse(result);
  } catch (error: any) {
    return errorResponse(error.message, 500);
  }
});
