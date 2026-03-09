// app/api/attendance/summary/student/[studentId]/route.ts
// GET student attendance summary

import { NextRequest } from "next/server";
import { withPermission } from "@/lib/api/withAuth";
import { apiSuccess, apiError } from "@/lib/api/response";
import { getStudentAttendanceSummary } from "@/features/attendance/services/attendance.service";

export const GET = withPermission(
  { module: "attendance", action: "view" },
  async (
    req: NextRequest,
    user,
    { params }: { params: { studentId: string } },
  ) => {
    try {
      const { searchParams } = new URL(req.url);
      const term = searchParams.get("term") || undefined;
      const academicYear = searchParams.get("academic_year") || undefined;

      const result = await getStudentAttendanceSummary(
        params.studentId,
        user.school_id,
        term,
        academicYear,
      );

      if (!result.success) {
        return apiError(result.message || "Failed to fetch summary", 500);
      }

      return apiSuccess(result.data);
    } catch (error) {
      return apiError("Internal server error", 500);
    }
  },
);
