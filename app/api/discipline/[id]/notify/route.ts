import { withPermission } from "@/lib/api/withAuth";
import { errorResponse, successResponse } from "@/lib/api/response";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getVisibleStudentIdsForUser } from "../../_lib";

export const POST = withPermission("compliance", "update", async (_request, { user, params }) => {
  try {
    const supabase = await createSupabaseServerClient();
    let query = supabase
      .from("disciplinary_records")
      .select("id")
      .eq("id", params.id)
      .eq("school_id", user.schoolId!);

    const visibleStudentIds = await getVisibleStudentIdsForUser(user);
    if (visibleStudentIds) {
      if (visibleStudentIds.length === 0) {
        return errorResponse("Disciplinary record not found", 404);
      }

      query = query.in("student_id", visibleStudentIds);
    }

    const { data: record, error: recordError } = await query.maybeSingle();
    if (recordError) {
      return errorResponse(recordError.message, 500);
    }

    if (!record) {
      return errorResponse("Disciplinary record not found", 404);
    }

    const { error } = await supabase
      .from("disciplinary_records")
      .update({
        parent_notified: true,
        parent_notified_date: new Date().toISOString().slice(0, 10),
        updated_at: new Date().toISOString(),
      })
      .eq("id", params.id)
      .eq("school_id", user.schoolId!);

    if (error) {
      return errorResponse(error.message, 500);
    }

    return successResponse({ notified: true });
  } catch (error) {
    return errorResponse(
      error instanceof Error ? error.message : "Failed to notify parent",
      500,
    );
  }
});
