import { NextRequest } from "next/server";
import { withPermission } from "@/lib/api/withAuth";
import {
  errorResponse,
  paginatedResponse,
  successResponse,
} from "@/lib/api/response";
import {
  createBulkNotifications,
  createNotification,
  createNotificationSchema,
  getUserNotifications,
  notificationFilterSchema,
} from "@/features/communication";
import { validateBody, validateSearchParams } from "@/lib/api/validation";

export const GET = withPermission(
  { module: "communication", action: "view" },
  async (req: NextRequest, { user }) => {
    try {
      const params = validateSearchParams(req, notificationFilterSchema);
      if (!params.success) {
        return errorResponse(params.error, 422);
      }

      const { page, pageSize, ...filters } = params.data;
      const result = await getUserNotifications(
        user.id,
        user.schoolId!,
        filters,
        page,
        pageSize,
      );

      if (!result.success) {
        return errorResponse(result.message || "Failed to fetch notifications", 500);
      }

      const notifications = (result.data ?? []).map((row: any) => ({
        id: row.id,
        notification_id: row.id,
        title: row.title,
        body: row.body,
        type: row.type,
        read_status: row.read_status === true,
        is_read: row.read_status === true,
        read_at: row.read_at,
        action_url: row.action_url,
        created_at: row.created_at,
      }));

      return paginatedResponse(notifications, {
        page,
        pageSize,
        total: result.total ?? notifications.length,
      });
    } catch (error: any) {
      return errorResponse(error.message, 500);
    }
  },
);

export const POST = withPermission(
  { module: "communication", action: "create" },
  async (req: NextRequest, { user }) => {
    try {
      const body = await req.json();

      if (body.user_ids && Array.isArray(body.user_ids)) {
        const result = await createBulkNotifications(body, user.schoolId!);
        if (!result.success) {
          return errorResponse(result.message, 400);
        }

        return successResponse({ count: result.count }, 201);
      }

      const validation = validateBody(body, createNotificationSchema);
      if (!validation.success) {
        return errorResponse(validation.error, 422);
      }

      const result = await createNotification(validation.data, user.schoolId!);
      if (!result.success) {
        return errorResponse(result.message, 400);
      }

      return successResponse({ id: result.id }, 201);
    } catch (error: any) {
      if (error.name === "ZodError") {
        return errorResponse(error.errors, 422);
      }

      return errorResponse(error.message, 500);
    }
  },
);
