export const dynamic = 'force-dynamic';

// app/api/messages/sent/route.ts
// GET sent messages

import { NextRequest } from "next/server";
import { withPermission } from "@/lib/api/withAuth";
import { apiPaginated, apiError } from "@/lib/api/response";
import { getSentMessages } from "@/features/communication/services/messages.service";

export const GET = withPermission(
  { module: "communication", action: "view" },
  async (req: NextRequest, user) => {
    try {
      const { searchParams } = new URL(req.url);
      const page = parseInt(searchParams.get("page") || "1");
      const pageSize = parseInt(searchParams.get("pageSize") || "20");

      const result = await getSentMessages(
        user.id,
        user.schoolId!,
        page,
        pageSize,
      );

      if (!result.success) {
        return apiError(result.message || "Failed to fetch sent messages", 500);
      }

      return apiPaginated(result.data, result.total, page, pageSize);
    } catch (error) {
      return apiError("Internal server error", 500);
    }
  },
);
