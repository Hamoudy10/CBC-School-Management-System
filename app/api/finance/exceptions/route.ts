import { NextRequest } from "next/server";
import { withPermission } from "@/lib/api/withAuth";
import { successResponse, validationErrorResponse } from "@/lib/api/response";
import { validateQuery } from "@/lib/api/validation";
import {
  financeExceptionFiltersSchema,
  listFinanceExceptions,
} from "@/features/finance";

export const GET = withPermission(
  "finance",
  "view",
  async (request: NextRequest, { user }) => {
    const { searchParams } = new URL(request.url);
    const validation = validateQuery(
      searchParams,
      financeExceptionFiltersSchema,
    );

    if (!validation.success) {
      return validationErrorResponse(validation.errors!);
    }

    const result = await listFinanceExceptions(validation.data!, user);

    return successResponse(
      {
        items: result.data,
        summary: result.summary,
      },
      {
        page: result.page,
        pageSize: result.pageSize,
        total: result.total,
        totalPages: result.totalPages,
      },
    );
  },
);
