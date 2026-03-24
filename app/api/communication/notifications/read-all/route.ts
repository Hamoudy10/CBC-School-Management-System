import { NextRequest } from "next/server";
import { withAuth } from "@/lib/api/withAuth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { errorResponse, successResponse } from "@/lib/api/response";

export const PUT = withAuth(async (_req: NextRequest, user: any) => {
  try {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase
      .from("notifications")
      .update({
        read_status: "read",
        read_at: new Date().toISOString(),
      })
      .eq("user_id", user.id)
      .eq("school_id", user.school_id)
      .eq("read_status", "unread");

    if (error) {
      return errorResponse(error.message, 400);
    }

    return successResponse({ allRead: true });
  } catch (error: any) {
    return errorResponse(error.message, 500);
  }
});
