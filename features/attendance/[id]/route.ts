// @ts-nocheck
// app/api/attendance/[id]/route.ts
// GET/PUT/DELETE single attendance record

import { NextRequest } from "next/server";
import { withPermission } from "@/lib/api/withAuth";
import { successResponse, errorResponse } from "@/lib/api/response";
import { AttendanceService } from "@/features/attendance";
import { updateAttendanceSchema } from "@/features/attendance";

export const PUT = withPermission(
  "attendance",
  "edit",
  async (
    req: NextRequest,
    user: any,
    { params }: { params: { id: string } },
  ) => {
    try {
      const body = await req.json();
      const validated = updateAttendanceSchema.parse(body);

      const result = await AttendanceService.recordAttendance(
        user.school_id,
        {
          ...validated,
          student_id: body.student_id,
          class_id: body.class_id,
          date: body.date,
          status: validated.status || body.status,
        },
        user.id,
      );

      if (!result.success) return errorResponse(result.message, 400);
      return successResponse(result);
    } catch (error: any) {
      if (error.name === "ZodError") return errorResponse(error.errors, 422);
      return errorResponse(error.message, 500);
    }
  },
);

export const DELETE = withPermission(
  "attendance",
  "delete",
  async (
    req: NextRequest,
    user: any,
    { params }: { params: { id: string } },
  ) => {
    try {
      const result = await AttendanceService.deleteAttendance(
        user.school_id,
        params.id,
      );
      if (!result.success) return errorResponse(result.message, 400);
      return successResponse(result);
    } catch (error: any) {
      return errorResponse(error.message, 500);
    }
  },
);
