// @ts-nocheck
// app/api/attendance/student/[studentId]/route.ts
// GET student attendance summary

import { NextRequest } from "next/server";
import { withPermission } from "@/lib/api/withAuth";
import { successResponse, errorResponse } from "@/lib/api/response";
import { AttendanceService } from "@/features/attendance";

export const GET = withPermission(
  "attendance",
  "view",
  async (
    req: NextRequest,
    user: any,
    { params }: { params: { studentId: string } },
  ) => {
    try {
      const url = new URL(req.url);
      const dateFrom = url.searchParams.get("date_from") || undefined;
      const dateTo = url.searchParams.get("date_to") || undefined;

      const summary = await AttendanceService.getStudentSummary(
        user.school_id,
        params.studentId,
        dateFrom,
        dateTo,
      );

      return successResponse(summary);
    } catch (error: any) {
      return errorResponse(error.message, 500);
    }
  },
);
