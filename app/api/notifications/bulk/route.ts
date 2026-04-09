export const dynamic = 'force-dynamic';

// app/api/notifications/bulk/route.ts
// POST send bulk notifications (admin)

import { NextRequest } from "next/server";
import { withPermission } from "@/lib/api/withAuth";
import { validateBody } from "@/lib/api/validation";
import { apiSuccess, apiError } from "@/lib/api/response";
import { bulkNotificationSchema } from "@/features/communication";
import { createBulkNotifications } from "@/features/communication/services/notifications.service";

export const POST = withPermission(
  { module: "communication", action: "create" },
  async (req: NextRequest, user) => {
    try {
      const body = await req.json();
      const validation = validateBody(body, bulkNotificationSchema);

      if (!validation.success) {
        return apiError(validation.error, 422);
      }

      const result = await createBulkNotifications(
        validation.data,
        user.school_id,
      );

      if (!result.success) {
        return apiError(result.message, 400);
      }

      return apiSuccess({ count: result.count }, result.message, 201);
    } catch (error) {
      return apiError("Internal server error", 500);
    }
  },
);
