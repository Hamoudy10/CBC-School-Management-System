import { NextRequest } from "next/server";
import { withPermission } from "@/lib/api/withAuth";
import { errorResponse, successResponse } from "@/lib/api/response";
import { getUnreadCounts } from "@/features/communication";

export const GET = withPermission(
  { module: "communication", action: "view" },
  async (_req: NextRequest, { user }) => {
    try {
      const result = await getUnreadCounts(user.id, user.schoolId!);

      if (!result.success || !result.data) {
        return errorResponse(result.message || "Failed to load unread counts", 500);
      }

      return successResponse(result.data);
    } catch (error: any) {
      return errorResponse(error.message, 500);
    }
  },
);
