// app/api/reports/fee-statement/route.ts
// POST generate fee statement for a student

import { NextRequest } from "next/server";
import { withPermission } from "@/lib/api/withAuth";
import { successResponse, errorResponse } from "@/lib/api/response";
import { ReportsService } from "@/features/reports";
import { z } from "zod";

const schema = z.object({
  student_id: z.string().uuid(),
  academic_year: z.string().regex(/^\d{4}$/),
});

export const POST = withPermission(
  "reports",
  "create",
  async (req: NextRequest, user: any) => {
    try {
      const body = await req.json();
      const validated = schema.parse(body);

      const result = await ReportsService.generateFeeStatement(
        user.school_id,
        validated.student_id,
        validated.academic_year,
      );

      return successResponse(result, 201);
    } catch (error: any) {
      if (error.name === "ZodError") return errorResponse(error.errors, 422);
      return errorResponse(error.message, 500);
    }
  },
);
