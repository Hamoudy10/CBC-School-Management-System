export const dynamic = 'force-dynamic';

// app/api/notifications/route.ts
// GET user notifications, POST create notification (admin only)

import { NextRequest } from "next/server";
import { withAuth, withPermission } from "@/lib/api/withAuth";
import { validateBody, validateSearchParams } from "@/lib/api/validation";
import { apiSuccess, apiError, apiPaginated } from "@/lib/api/response";
import {
  createNotificationSchema,
  notificationFilterSchema,
} from "@/features/communication";
import {
  getUserNotifications,
  createNotification,
} from "@/features/communication/services/notifications.service";

export const GET = withAuth(async (req: NextRequest, user) => {
  try {
    const params = validateSearchParams(req, notificationFilterSchema);

    if (!params.success) {
      return apiError(params.error, 422);
    }

    const { page, pageSize, ...filters } = params.data;

    const result = await getUserNotifications(
      user.id,
      user.school_id,
      filters,
      page,
      pageSize,
    );

    if (!result.success) {
      return apiError(result.message || "Failed to fetch notifications", 500);
    }

    return apiPaginated(result.data, result.total, page, pageSize);
  } catch (error) {
    return apiError("Internal server error", 500);
  }
});

export const POST = withPermission(
  { module: "communication", action: "create" },
  async (req: NextRequest, user) => {
    try {
      const body = await req.json();
      const validation = validateBody(body, createNotificationSchema);

      if (!validation.success) {
        return apiError(validation.error, 422);
      }

      const result = await createNotification(validation.data, user.school_id);

      if (!result.success) {
        return apiError(result.message, 400);
      }

      return apiSuccess({ id: result.id }, result.message, 201);
    } catch (error) {
      return apiError("Internal server error", 500);
    }
  },
);
