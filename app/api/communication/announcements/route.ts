// app/api/communication/announcements/route.ts
// GET announcements, POST create announcement

import { NextRequest } from "next/server";
import { withAuth, withPermission } from "@/lib/api/withAuth";
import {
  successResponse,
  errorResponse,
  paginatedResponse,
} from "@/lib/api/response";
import { AnnouncementsService } from "@/features/communication";
import { createAnnouncementSchema } from "@/features/communication";

export const GET = withAuth(async (req: NextRequest, user: any) => {
  try {
    const url = new URL(req.url);
    const page = parseInt(url.searchParams.get("page") || "1");
    const pageSize = parseInt(url.searchParams.get("page_size") || "20");
    const viewAll = url.searchParams.get("all") === "true";

    const result = viewAll
      ? await AnnouncementsService.getAllAnnouncements(
          user.school_id,
          page,
          pageSize,
        )
      : await AnnouncementsService.getAnnouncementsForUser(
          user.school_id,
          user.role,
          page,
          pageSize,
        );

    return paginatedResponse(result.data, {
      page,
      pageSize,
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
      const validated = createAnnouncementSchema.parse(body);
      const result = await AnnouncementsService.createAnnouncement(
        user.school_id,
        validated,
        user.id,
      );

      if (!result.success) return errorResponse(result.message, 400);
      return successResponse(result, 201);
    } catch (error: any) {
      if (error.name === "ZodError") return errorResponse(error.errors, 422);
      return errorResponse(error.message, 500);
    }
  },
);
