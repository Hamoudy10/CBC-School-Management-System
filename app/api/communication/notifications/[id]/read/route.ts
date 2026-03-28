import { NextRequest } from "next/server";
import { withPermission } from "@/lib/api/withAuth";
import { errorResponse, successResponse } from "@/lib/api/response";
import { markNotificationAsRead } from "@/features/communication";

export const PUT = withPermission(
  { module: "communication", action: "view" },
  async (
    _req: NextRequest,
    { user, params }: { user: any; params: { id: string } },
  ) => {
    try {
      const result = await markNotificationAsRead(
        params.id,
        user.id,
        user.schoolId!,
      );

      if (!result.success) {
        return errorResponse(result.message, 400);
      }

      return successResponse({ id: params.id, read: true });
    } catch (error: any) {
      return errorResponse(error.message, 500);
    }
  },
);
