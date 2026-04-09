export const dynamic = 'force-dynamic';

// app/api/reports/term-report/route.ts
// POST generate term report for a student

import { NextRequest } from "next/server";
import { withPermission } from "@/lib/api/withAuth";
import { successResponse, errorResponse } from "@/lib/api/response";
import { ReportsService, termReportRequestSchema } from "@/features/reports";

export const POST = withPermission(
  "reports",
  "create",
  async (req: NextRequest, user: any) => {
    try {
      const body = await req.json();
      const validated = termReportRequestSchema.parse(body);

      const result = await ReportsService.generateTermReport(
        user.school_id,
        validated.student_id,
        validated.term,
        validated.academic_year,
        user.id,
        {
          class_teacher_remarks: validated.class_teacher_remarks,
          principal_remarks: validated.principal_remarks,
          next_term_opens: validated.next_term_opens,
          closing_date: validated.closing_date,
        },
      );

      if (!result.success) {return errorResponse(result.message, 400);}
      return successResponse(result, 201);
    } catch (error: any) {
      if (error.name === "ZodError") {return errorResponse(error.errors, 422);}
      return errorResponse(error.message, 500);
    }
  },
);
