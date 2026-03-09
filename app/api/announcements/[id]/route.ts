// app/api/announcements/[id]/route.ts
// GET single, PUT update, DELETE deactivate announcement

import { NextRequest } from "next/server";
import { withAuth, withPermission } from "@/lib/api/withAuth";
import { validateBody } from "@/lib/api/validation";
import { apiSuccess, apiError } from "@/lib/api/response";
import { updateAnnouncementSchema } from "@/features/communication";
import {
  getAnnouncementById,
  updateAnnouncement,
  deleteAnnouncement,
} from "@/features/communication/services/announcements.service";

export const GET = withAuth(
  async (req: NextRequest, user, { params }: { params: { id: string } }) => {
    try {
      const result = await getAnnouncementById(params.id, user.school_id);

      if (!result.success) {
        return apiError(result.message || "Announcement not found", 404);
      }

      return apiSuccess(result.data);
    } catch (error) {
      return apiError("Internal server error", 500);
    }
  },
);

export const PUT = withPermission(
  { module: "communication", action: "edit" },
  async (req: NextRequest, user, { params }: { params: { id: string } }) => {
    try {
      const body = await req.json();
      const validation = validateBody(body, updateAnnouncementSchema);

      if (!validation.success) {
        return apiError(validation.error, 422);
      }

      const result = await updateAnnouncement(
        params.id,
        validation.data,
        user.school_id,
      );

      if (!result.success) {
        return apiError(result.message, 400);
      }

      return apiSuccess(null, result.message);
    } catch (error) {
      return apiError("Internal server error", 500);
    }
  },
);

export const DELETE = withPermission(
  { module: "communication", action: "delete" },
  async (req: NextRequest, user, { params }: { params: { id: string } }) => {
    try {
      const result = await deleteAnnouncement(params.id, user.school_id);

      if (!result.success) {
        return apiError(result.message, 400);
      }

      return apiSuccess(null, result.message);
    } catch (error) {
      return apiError("Internal server error", 500);
    }
  },
);
