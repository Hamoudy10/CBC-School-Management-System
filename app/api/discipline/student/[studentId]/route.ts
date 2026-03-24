import { withPermission } from "@/lib/api/withAuth";
import { errorResponse, successResponse } from "@/lib/api/response";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  getVisibleStudentIdsForUser,
  mapDisciplineRows,
} from "../../_lib";

const detailSelect = `
  *,
  student:students!disciplinary_records_student_id_fkey(
    student_id,
    first_name,
    last_name,
    admission_number,
    photo_url,
    current_class_id
  ),
  recorded_by_user:users!disciplinary_records_recorded_by_fkey(
    user_id,
    first_name,
    last_name
  ),
  resolved_by_user:users!disciplinary_records_resolved_by_fkey(
    user_id,
    first_name,
    last_name
  )
`;

export const GET = withPermission(
  "compliance",
  "view",
  async (_request, { user, params }) => {
    try {
      const visibleStudentIds = await getVisibleStudentIdsForUser(user);
      if (visibleStudentIds && !visibleStudentIds.includes(params.studentId)) {
        return successResponse({ records: [], total: 0 });
      }

      const supabase = await createSupabaseServerClient();
      const { data, error, count } = await supabase
        .from("disciplinary_records")
        .select(detailSelect, { count: "exact" })
        .eq("school_id", user.schoolId!)
        .eq("student_id", params.studentId)
        .order("incident_date", { ascending: false });

      if (error) {
        return errorResponse(error.message, 500);
      }

      const records = await mapDisciplineRows(data ?? []);
      return successResponse({
        records,
        total: count ?? records.length,
      });
    } catch (error) {
      return errorResponse(
        error instanceof Error ? error.message : "Failed to fetch discipline history",
        500,
      );
    }
  },
);
