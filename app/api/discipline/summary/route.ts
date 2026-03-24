import { withPermission } from "@/lib/api/withAuth";
import { errorResponse, successResponse } from "@/lib/api/response";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  buildDisciplineSummary,
  getVisibleStudentIdsForUser,
} from "../_lib";

const summarySelect = `
  id,
  student_id,
  incident_type,
  severity,
  status,
  incident_date,
  student:students!disciplinary_records_student_id_fkey(
    student_id,
    first_name,
    last_name,
    admission_number,
    current_class_id
  )
`;

export const GET = withPermission("compliance", "view", async (request, { user }) => {
  try {
    const supabase = await createSupabaseServerClient();
    const { searchParams } = new URL(request.url);
    const classId = searchParams.get("class_id") ?? searchParams.get("classId");
    const dateFrom = searchParams.get("date_from") ?? searchParams.get("dateFrom");
    const dateTo = searchParams.get("date_to") ?? searchParams.get("dateTo");

    let visibleStudentIds = await getVisibleStudentIdsForUser(user);

    if (classId) {
      const { data: classStudents, error: classStudentsError } = await supabase
        .from("students")
        .select("student_id")
        .eq("school_id", user.schoolId!)
        .eq("current_class_id", classId);

      if (classStudentsError) {
        return errorResponse(classStudentsError.message, 500);
      }

      const classStudentIds = (classStudents ?? []).map((row: any) => row.student_id);
      visibleStudentIds = visibleStudentIds
        ? visibleStudentIds.filter((id) => classStudentIds.includes(id))
        : classStudentIds;
    }

    if (visibleStudentIds && visibleStudentIds.length === 0) {
      return successResponse(buildDisciplineSummary([]));
    }

    let query = supabase
      .from("disciplinary_records")
      .select(summarySelect)
      .eq("school_id", user.schoolId!);

    if (visibleStudentIds) {
      query = query.in("student_id", visibleStudentIds);
    }
    if (dateFrom) {
      query = query.gte("incident_date", dateFrom);
    }
    if (dateTo) {
      query = query.lte("incident_date", dateTo);
    }

    const { data, error } = await query;
    if (error) {
      return errorResponse(error.message, 500);
    }

    return successResponse(buildDisciplineSummary(data ?? []));
  } catch (error) {
    return errorResponse(
      error instanceof Error ? error.message : "Failed to fetch discipline summary",
      500,
    );
  }
});
