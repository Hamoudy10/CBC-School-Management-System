import { NextRequest } from "next/server";
import { withPermission } from "@/lib/api/withAuth";
import { apiError, apiSuccess } from "@/lib/api/response";
import { getStudentAttendanceSummary } from "@/features/attendance/services/attendance.service";

export const GET = withPermission(
  { module: "attendance", action: "view" },
  async (req: NextRequest, user, { params }: { params: { studentId: string } }) => {
    const { searchParams } = new URL(req.url);
    const termId = searchParams.get("termId") || searchParams.get("term") || undefined;
    const academicYearId =
      searchParams.get("academicYearId") || searchParams.get("academic_year") || undefined;

    const result = await getStudentAttendanceSummary(
      params.studentId,
      user.school_id,
      termId,
      academicYearId,
    );

    if (!result.success) {
      return apiError(result.message ?? "Failed to fetch summary", 500);
    }

    return apiSuccess(result.data);
  },
);
