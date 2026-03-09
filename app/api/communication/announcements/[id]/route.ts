// app/api/communication/announcements/[id]/route.ts
// PUT update, DELETE announcement

import { NextRequest } from "next/server";
import { withPermission } from "@/lib/api/withAuth";
import { successResponse, errorResponse } from "@/lib/api/response";
import { AnnouncementsService } from "@/features/communication";

export const PUT = withPermission(
  "communication",
  "edit",
  async (
    req: NextRequest,
    user: any,
    { params }: { params: { id: string } },
  ) => {
    try {
      const body = await req.json();
      const result = await AnnouncementsService.updateAnnouncement(
        user.school_id,
        params.id,
        body,
      );
      if (!result.success) return errorResponse(result.message, 400);
      return successResponse(result);
    } catch (error: any) {
      return errorResponse(error.message, 500);
    }
  },
);

export const DELETE = withPermission(
  "communication",
  "delete",
  async (
    req: NextRequest,
    user: any,
    { params }: { params: { id: string } },
  ) => {
    try {
      const result = await AnnouncementsService.deleteAnnouncement(
        user.school_id,
        params.id,
      );
      if (!result.success) return errorResponse(result.message, 400);
      return successResponse(result);
    } catch (error: any) {
      return errorResponse(error.message, 500);
    }
  },
);
