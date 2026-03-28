import { NextRequest } from "next/server";
import { withPermission } from "@/lib/api/withAuth";
import { errorResponse, successResponse } from "@/lib/api/response";
import { markAllNotificationsAsRead } from "@/features/communication";

export const PUT = withPermission(
  { module: "communication", action: "view" },
  async (_req: NextRequest, { user }) => {
    try {
      const result = await markAllNotificationsAsRead(user.id, user.schoolId!);

      if (!result.success) {
        return errorResponse(result.message, 400);
      }

      return successResponse({ allRead: true, message: result.message });
    } catch (error: any) {
      return errorResponse(error.message, 500);
    }
  },
);
