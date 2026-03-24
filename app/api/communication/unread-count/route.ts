import { NextRequest } from "next/server";
import { withAuth } from "@/lib/api/withAuth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { errorResponse, successResponse } from "@/lib/api/response";

export const GET = withAuth(async (_req: NextRequest, user: any) => {
  try {
    const supabase = await createSupabaseServerClient();

    const [{ count: messageCount, error: messageError }, { count: notificationCount, error: notificationError }] =
      await Promise.all([
        supabase
          .from("messages")
          .select("id", { count: "exact", head: true })
          .eq("school_id", user.school_id)
          .eq("receiver_id", user.id)
          .eq("is_archived", false)
          .eq("read_status", "unread"),
        supabase
          .from("notifications")
          .select("id", { count: "exact", head: true })
          .eq("school_id", user.school_id)
          .eq("user_id", user.id)
          .eq("read_status", "unread"),
      ]);

    if (messageError) {
      return errorResponse(messageError.message, 500);
    }

    if (notificationError) {
      return errorResponse(notificationError.message, 500);
    }

    const messages = messageCount ?? 0;
    const notifications = notificationCount ?? 0;

    return successResponse({
      messages,
      notifications,
      total: messages + notifications,
    });
  } catch (error: any) {
    return errorResponse(error.message, 500);
  }
});
