export const dynamic = 'force-dynamic';

import { withPermission } from "@/lib/api/withAuth";
import { errorResponse, successResponse } from "@/lib/api/response";
import { markAllMessagesAsRead } from "@/features/communication";

export const POST = withPermission(
  { module: "communication", action: "view" },
  async (_req, { user }) => {
    try {
      const result = await markAllMessagesAsRead(user.id, user.schoolId!);

      if (!result.success) {
        return errorResponse(result.message, 400);
      }

      return successResponse({ message: result.message });
    } catch (error: any) {
      return errorResponse(error.message, 500);
    }
  },
);
