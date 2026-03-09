// app/api/reports/list/route.ts
// GET list generated reports

import { NextRequest } from "next/server";
import { withPermission } from "@/lib/api/withAuth";
import { paginatedResponse, errorResponse } from "@/lib/api/response";
import { validateSearchParams } from "@/lib/api/validation";
import { ReportsService } from "@/features/reports";
import { reportFilterSchema } from "@/features/reports";

export const GET = withPermission(
  "reports",
  "view",
  async (req: NextRequest, user: any) => {
    try {
      const params = validateSearchParams(req, reportFilterSchema);
      const { data, total } = await ReportsService.listReports(
        user.school_id,
        params,
      );

      return paginatedResponse(data, {
        page: params.page,
        pageSize: params.page_size,
        total,
      });
    } catch (error: any) {
      return errorResponse(error.message, 500);
    }
  },
);
