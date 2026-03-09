// app/api/notifications/unread-count/route.ts
// GET unread count for messages + notifications

import { NextRequest } from "next/server";
import { withAuth } from "@/lib/api/withAuth";
import { apiSuccess, apiError } from "@/lib/api/response";
import { getUnreadCounts } from "@/features/communication/services/notifications.service";

export const GET = withAuth(async (req: NextRequest, user) => {
  try {
    const result = await getUnreadCounts(user.id, user.school_id);

    if (!result.success) {
      return apiError(result.message || "Failed to fetch unread counts", 500);
    }

    return apiSuccess(result.data);
  } catch (error) {
    return apiError("Internal server error", 500);
  }
});
