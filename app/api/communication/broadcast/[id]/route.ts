// app/api/communication/broadcast/[id]/route.ts
// GET single broadcast message, DELETE broadcast message

import { NextRequest } from "next/server";
import { withPermission } from "@/lib/api/withAuth";
import { successResponse, errorResponse, notFoundResponse } from "@/lib/api/response";
import { validateUuid } from "@/lib/api/validation";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const GET = withPermission(
  { module: "communication", action: "view" },
  async (
    _req: NextRequest,
    { user, params }: { user: any; params: { id: string } },
  ) => {
    try {
      const idValidation = validateUuid(params.id);
      if (!idValidation.success) {
        return errorResponse(idValidation.error, 400);
      }

      const supabase = await createSupabaseServerClient();

      const { data, error } = await supabase
        .from("broadcast_messages")
        .select(`
          *,
          creator:users!broadcast_messages_created_by_fkey (
            id,
            first_name,
            last_name,
            email
          )
        `)
        .eq("id", params.id)
        .eq("school_id", user.school_id)
        .single();

      if (error) {
        if (error.code === "PGRST116") {
          return notFoundResponse("Broadcast message not found");
        }
        return errorResponse(error.message, 400);
      }

      return successResponse(data);
    } catch (error: any) {
      return errorResponse(error.message, 500);
    }
  },
);

export const DELETE = withPermission(
  "communication",
  "delete",
  async (
    _req: NextRequest,
    { user, params }: { user: any; params: { id: string } },
  ) => {
    try {
      const idValidation = validateUuid(params.id);
      if (!idValidation.success) {
        return errorResponse(idValidation.error, 400);
      }

      const supabase = await createSupabaseServerClient();

      const { error } = await supabase
        .from("broadcast_messages")
        .delete()
        .eq("id", params.id)
        .eq("school_id", user.school_id);

      if (error) {
        if (error.code === "PGRST116") {
          return notFoundResponse("Broadcast message not found");
        }
        return errorResponse(error.message, 400);
      }

      return successResponse({ id: params.id, deleted: true });
    } catch (error: any) {
      return errorResponse(error.message, 500);
    }
  },
);
