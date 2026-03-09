// app/api/audit-logs/route.ts
// ============================================================
// GET /api/audit-logs - List audit trail entries
// ============================================================

import { NextRequest } from "next/server";
import { withPermission } from "@/lib/api/withAuth";
import { validateQuery } from "@/lib/api/validation";
import { successResponse, validationErrorResponse } from "@/lib/api/response";
import { listAuditTrail, auditTrailFiltersSchema } from "@/features/users";

// ============================================================
// GET Handler - List Audit Trail
// ============================================================
export const GET = withPermission(
  "audit_logs",
  "view",
  async (request, { user }) => {
    const { searchParams } = new URL(request.url);

    const validation = validateQuery(searchParams, auditTrailFiltersSchema);
    if (!validation.success) {
      return validationErrorResponse(validation.errors!);
    }

    const result = await listAuditTrail(validation.data!, user);

    return successResponse(result.data, {
      page: result.page,
      pageSize: result.pageSize,
      total: result.total,
      totalPages: result.totalPages,
    });
  },
);
