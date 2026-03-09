// app/api/reports/report-card/route.ts
// POST generate single student report card

import { NextRequest } from "next/server";
import { withPermission } from "@/lib/api/withAuth";
import { validateBody } from "@/lib/api/validation";
import { apiSuccess, apiError } from "@/lib/api/response";
import { generateReportCardSchema } from "@/features/reports";
import { generateStudentReportCard } from "@/features/reports/services/reports.service";

export const POST = withPermission(
  { module: "reports", action: "create" },
  async (req: NextRequest, user) => {
    try {
      const body = await req.json();
      const validation = validateBody(body, generateReportCardSchema);

      if (!validation.success) {
        return apiError(validation.error, 422);
      }

      const { student_id, term, academic_year } = validation.data;

      const result = await generateStudentReportCard(
        student_id,
        term,
        academic_year,
        user.school_id,
        user.id,
      );

      if (!result.success) {
        return apiError(result.message, 400);
      }

      return apiSuccess(
        {
          html: result.html,
          data: result.data,
        },
        result.message,
        201,
      );
    } catch (error) {
      return apiError("Internal server error", 500);
    }
  },
);
