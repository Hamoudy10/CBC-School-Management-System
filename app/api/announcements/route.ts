// app/api/announcements/route.ts
// GET announcements, POST create announcement

import { NextRequest } from "next/server";
import { withAuth, withPermission } from "@/lib/api/withAuth";
import { validateBody } from "@/lib/api/validation";
import { apiSuccess, apiError, apiPaginated } from "@/lib/api/response";
import { createAnnouncementSchema } from "@/features/communication";
import {
  getAnnouncements,
  createAnnouncement,
} from "@/features/communication/services/announcements.service";

export const GET = withAuth(async (req: NextRequest, user) => {
  try {
    const { searchParams } = new URL(req.url);
    const category = searchParams.get("category") || undefined;
    const page = parseInt(searchParams.get("page") || "1");
    const pageSize = parseInt(searchParams.get("pageSize") || "20");

    const result = await getAnnouncements(
      user.school_id,
      {
        category,
        is_active: true,
        target_role: user.role,
      },
      page,
      pageSize,
    );

    if (!result.success) {
      return apiError(result.message || "Failed to fetch announcements", 500);
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
      const validation = validateBody(body, createAnnouncementSchema);

      if (!validation.success) {
        return apiError(validation.error, 422);
      }

      const result = await createAnnouncement(
        validation.data,
        user.id,
        user.school_id,
      );

      if (!result.success) {
        return apiError(result.message, 400);
      }

      return apiSuccess({ id: result.id }, result.message, 201);
    } catch (error) {
      return apiError("Internal server error", 500);
    }
  },
);
