// app/api/communication/notifications/route.ts
// GET user notifications, POST create notification (admin)

import { NextRequest } from "next/server";
import { withAuth, withPermission } from "@/lib/api/withAuth";
import {
  successResponse,
  errorResponse,
  paginatedResponse,
} from "@/lib/api/response";
import { validateSearchParams } from "@/lib/api/validation";
import { NotificationsService } from "@/features/communication";
import {
  createNotificationSchema,
  bulkNotificationSchema,
  notificationFilterSchema,
} from "@/features/communication";

export const GET = withAuth(async (req: NextRequest, user: any) => {
  try {
    const params = validateSearchParams(req, notificationFilterSchema);
    if (!params.success) {
      return errorResponse(params.error, 422);
    }
    const filters = params.data;
    const result = await NotificationsService.getUserNotifications(
      user.school_id,
      user.id,
      filters,
    );

    return paginatedResponse(result.data, {
      page: filters.page,
      pageSize: filters.pageSize,
      total: result.total,
    });
  } catch (error: any) {
    return errorResponse(error.message, 500);
  }
});

export const POST = withPermission(
  "communication",
  "create",
  async (req: NextRequest, user: any) => {
    try {
      const body = await req.json();

      // Check if bulk or single
      if (body.user_ids && Array.isArray(body.user_ids)) {
        const validated = bulkNotificationSchema.parse(body);
        const result = await NotificationsService.createBulkNotifications(
          user.school_id,
          validated.user_ids,
          validated,
        );
        return successResponse(result, 201);
      }

      const validated = createNotificationSchema.parse(body);
      const result = await NotificationsService.createNotification(
        user.school_id,
        validated,
      );

      return successResponse(result, 201);
    } catch (error: any) {
      if (error.name === "ZodError") return errorResponse(error.errors, 422);
      return errorResponse(error.message, 500);
    }
  },
);
