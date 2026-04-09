import { withPermission } from "@/lib/api/withAuth";
import { validateUuid } from "@/lib/api/validation";
import {
  errorResponse,
  notFoundResponse,
  successResponse,
  validationErrorResponse,
} from "@/lib/api/response";
import { deactivateTeacherSubject } from "@/features/academics";
import { createSupabaseServerClient } from "@/lib/supabase/server";

// ============================================================
// GET Handler - Get single teacher-subject assignment
// ============================================================
export const GET = withPermission("academics", "view", async (_request, { user, params }) => {
  const id = params?.id;
  if (!id) {
    return notFoundResponse("Assignment ID required");
  }

  const validation = validateUuid(id);
  if (!validation.success) {
    return validationErrorResponse(validation.errors!);
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("teacher_subjects")
    .select(
      `
      *,
      staff:staff!teacher_subjects_teacher_id_fkey(user_id, first_name, last_name),
      class:classes!inner(name),
      learning_area:learning_areas!inner(name, code)
    `,
    )
    .eq("id", id)
    .eq("school_id", user.school_id)
    .maybeSingle();

  if (error) {
    return errorResponse(error.message, 500);
  }

  if (!data) {
    return notFoundResponse("Teacher subject assignment not found");
  }

  return successResponse(data);
});

// ============================================================
// DELETE Handler - Deactivate teacher-subject assignment
// ============================================================
export const DELETE = withPermission("academics", "update", async (_request, { user, params }) => {
  const id = params?.id;
  if (!id) {
    return notFoundResponse("Assignment ID required");
  }

  const validation = validateUuid(id);
  if (!validation.success) {
    return validationErrorResponse(validation.errors!);
  }

  const result = await deactivateTeacherSubject(id, user);
  if (!result.success) {
    return errorResponse(result.message);
  }

  return successResponse({ assignmentId: id });
});