// app/api/communication/unread-count/route.ts
// GET unread messages + notifications count

import { NextRequest } from "next/server";
import { withAuth } from "@/lib/api/withAuth";
import { successResponse, errorResponse } from "@/lib/api/response";
import { MessagesService } from "@/features/communication";

export const GET = withAuth(async (req: NextRequest, user: any) => {
  try {
    const counts = await MessagesService.getUnreadCount(
      user.school_id,
      user.id,
    );
    return successResponse(counts);
  } catch (error: any) {
    return errorResponse(error.message, 500);
  }
});
