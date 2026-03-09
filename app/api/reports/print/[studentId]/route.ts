// app/api/reports/print/[studentId]/route.ts
// GET printable HTML report card

import { NextRequest, NextResponse } from "next/server";
import { withPermission } from "@/lib/api/withAuth";
import { apiError } from "@/lib/api/response";
import { assembleReportCardData } from "@/features/reports/services/reportCard.generator";
import { generateReportCardHTML } from "@/features/reports/services/pdf.service";

export const GET = withPermission(
  { module: "reports", action: "view" },
  async (
    req: NextRequest,
    user,
    { params }: { params: { studentId: string } },
  ) => {
    try {
      const { searchParams } = new URL(req.url);
      const term = searchParams.get("term");
      const academicYear = searchParams.get("academic_year");

      if (!term || !academicYear) {
        return apiError("term and academic_year parameters are required", 422);
      }

      const reportData = await assembleReportCardData(
        params.studentId,
        term,
        academicYear,
        user.school_id,
      );

      if (!reportData.success || !reportData.data) {
        return apiError(reportData.message || "Failed to generate report", 400);
      }

      const html = generateReportCardHTML(reportData.data);

      return new NextResponse(html, {
        status: 200,
        headers: {
          "Content-Type": "text/html; charset=utf-8",
          "Cache-Control": "no-store",
        },
      });
    } catch (error) {
      return apiError("Internal server error", 500);
    }
  },
);
