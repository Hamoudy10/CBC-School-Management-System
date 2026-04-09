export const dynamic = 'force-dynamic';

// app/api/reports/class-list/route.ts
// POST generate class list report

import { NextRequest } from "next/server";
import { withPermission } from "@/lib/api/withAuth";
import { successResponse, errorResponse } from "@/lib/api/response";
import { ReportsService } from "@/features/reports";
import { z } from "zod";

const schema = z.object({
  class_id: z.string().uuid(),
  term: z.enum(["Term 1", "Term 2", "Term 3"]),
  academic_year: z.string().regex(/^\d{4}$/),
});

export const POST = withPermission(
  "reports",
  "create",
  async (req: NextRequest, user: any) => {
    try {
      const body = await req.json();
      const validated = schema.parse(body);

      const result = await ReportsService.generateClassList(
        user.school_id,
        validated.class_id,
        validated.term,
        validated.academic_year,
      );

      return successResponse(result, 201);
    } catch (error: any) {
      if (error.name === "ZodError") {return errorResponse(error.errors, 422);}
      return errorResponse(error.message, 500);
    }
  },
);
