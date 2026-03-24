import { NextRequest } from "next/server";
import { withPermission } from "@/lib/api/withAuth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { errorResponse, successResponse } from "@/lib/api/response";
import { updateAnnouncementSchema } from "@/features/communication";

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
      const validated = updateAnnouncementSchema.parse(body);
      const supabase = await createSupabaseServerClient();

      const updateData: Record<string, unknown> = {};

      if (validated.title !== undefined) {
        updateData.title = validated.title;
      }
      if (validated.body !== undefined) {
        updateData.body = validated.body;
      }
      if (validated.priority !== undefined) {
        updateData.priority = validated.priority;
      }
      if (validated.target_roles !== undefined) {
        updateData.target_roles = validated.target_roles;
      }
      if (validated.target_classes !== undefined) {
        updateData.target_class_ids = validated.target_classes;
      }
      if (validated.publish_date !== undefined) {
        updateData.publish_at = `${validated.publish_date}T00:00:00`;
      }
      if (validated.expiry_date !== undefined) {
        updateData.expires_at = validated.expiry_date
          ? `${validated.expiry_date}T23:59:59`
          : null;
      }
      if (validated.is_active !== undefined) {
        updateData.expires_at = validated.is_active ? null : new Date().toISOString();
      }
      updateData.updated_at = new Date().toISOString();

      const { error } = await supabase
        .from("announcements")
        .update(updateData)
        .eq("id", params.id)
        .eq("school_id", user.school_id);

      if (error) {
        return errorResponse(error.message, 400);
      }

      return successResponse({ id: params.id, updated: true });
    } catch (error: any) {
      if (error.name === "ZodError") {
        return errorResponse(error.errors, 422);
      }

      return errorResponse(error.message, 500);
    }
  },
);

export const DELETE = withPermission(
  "communication",
  "delete",
  async (
    _req: NextRequest,
    user: any,
    { params }: { params: { id: string } },
  ) => {
    try {
      const supabase = await createSupabaseServerClient();
      const { error } = await supabase
        .from("announcements")
        .update({
          expires_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", params.id)
        .eq("school_id", user.school_id);

      if (error) {
        return errorResponse(error.message, 400);
      }

      return successResponse({ id: params.id, deleted: true });
    } catch (error: any) {
      return errorResponse(error.message, 500);
    }
  },
);
