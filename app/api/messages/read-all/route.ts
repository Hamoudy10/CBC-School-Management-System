// app/api/messages/read-all/route.ts
// POST mark all messages as read

import { NextRequest } from "next/server";
import { withAuth } from "@/lib/api/withAuth";
import { apiSuccess, apiError } from "@/lib/api/response";
import { markAllMessagesAsRead } from "@/features/communication/services/messages.service";

export const POST = withAuth(async (req: NextRequest, user) => {
  try {
    const result = await markAllMessagesAsRead(user.id, user.schoolId!);

    if (!result.success) {
      return apiError(result.message, 400);
    }

    return apiSuccess(null, result.message);
  } catch (error) {
    return apiError("Internal server error", 500);
  }
});
