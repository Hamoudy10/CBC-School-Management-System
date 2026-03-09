// app/api/report-cards/generate-class/route.ts
// ============================================================
// POST /api/report-cards/generate-class - Generate for entire class
// ============================================================

import { NextRequest } from "next/server";
import { z } from "zod";
import { withPermission } from "@/lib/api/withAuth";
import { validateBody } from "@/lib/api/validation";
import { checkReportGenerationRateLimit } from "@/lib/api/rateLimit";
import {
  successResponse,
  errorResponse,
  validationErrorResponse,
  rateLimitResponse,
} from "@/lib/api/response";
import { generateClassReportCards } from "@/features/assessments";

// ============================================================
// Schema
// ============================================================
const generateClassSchema = z.object({
  classId: z.string().uuid(),
  academicYearId: z.string().uuid(),
  termId: z.string().uuid(),
  reportType: z.enum(["term", "yearly"]),
});

// ============================================================
// POST Handler
// ============================================================
export const POST = withPermission(
  "reports",
  "create",
  async (request, { user }) => {
    // Rate limit
    const rateLimit = checkReportGenerationRateLimit(request, user.id);
    if (!rateLimit.allowed) {
      return rateLimitResponse("Too many report generation requests.");
    }

    const validation = await validateBody(request, generateClassSchema);
    if (!validation.success) {
      return validationErrorResponse(validation.errors!);
    }

    const { classId, academicYearId, termId, reportType } = validation.data!;

    const result = await generateClassReportCards(
      classId,
      academicYearId,
      termId,
      reportType,
      user,
    );

    if (!result.success && result.generated === 0) {
      return errorResponse(result.message);
    }

    return successResponse({
      message: result.message,
      generated: result.generated,
      failed: result.failed,
    });
  },
);
