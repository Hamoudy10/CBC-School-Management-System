// app/api/reports/attendance-report/route.ts
// POST generate attendance report for a class

import { NextRequest } from "next/server";
import { withPermission } from "@/lib/api/withAuth";
import { successResponse, errorResponse } from "@/lib/api/response";
import { ReportsService } from "@/features/reports";
import { z } from "zod";

const schema = z.object({
  class_id: z.string().uuid(),
  term: z.enum(["Term 1", "Term 2", "Term 3"]),
  academic_year: z.string().regex(/^\d{4}$/),
  date_from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  date_to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export const POST = withPermission(
  "reports",
  "create",
  async (req: NextRequest, user: any) => {
    try {
      const body = await req.json();
      const validated = schema.parse(body);

      const result = await ReportsService.generateAttendanceReport(
        user.school_id,
        validated.class_id,
        validated.term,
        validated.academic_year,
        validated.date_from,
        validated.date_to,
      );

      return successResponse(result, 201);
    } catch (error: any) {
      if (error.name === "ZodError") return errorResponse(error.errors, 422);
      return errorResponse(error.message, 500);
    }
  },
);
