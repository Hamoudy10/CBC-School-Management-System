// app/api/staff/[id]/status-history/route.ts
// ============================================================
// GET /api/staff/:id/status-history - Get staff status change history
// ============================================================

import { NextRequest } from "next/server";
import { withPermission } from "@/lib/api/withAuth";
import { validateUuid } from "@/lib/api/validation";
import {
  successResponse,
  errorResponse,
  notFoundResponse,
  validationErrorResponse,
} from "@/lib/api/response";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getStaffById } from "@/features/staff/services/staff.services";

export const GET = withPermission(
  "teachers",
  "view",
  async (request: NextRequest, { user, params }) => {
    const staffId = params?.id;
    if (!staffId) {
      return notFoundResponse("Staff ID required");
    }

    const validation = validateUuid(staffId);
    if (!validation.success) {
      return validationErrorResponse(validation.errors!);
    }

    try {
      // Verify staff exists and user has access
      const existingStaff = await getStaffById(staffId, user);
      if (!existingStaff) {
        return notFoundResponse("Staff member not found.");
      }

      const supabase = await createSupabaseServerClient();

      const { data, error } = await supabase
        .from("staff_status_history")
        .select(
          `
          history_id,
          staff_id,
          previous_status,
          new_status,
          reason,
          changed_at,
          changer:users!staff_status_history_changed_by_fkey (
            first_name,
            last_name
          )
        `
        )
        .eq("staff_id", staffId)
        .order("changed_at", { ascending: false });

      if (error) {
        return errorResponse(`Failed to load status history: ${error.message}`, 500);
      }

      const history = (data ?? []).map((row: any) => {
        const changer = Array.isArray(row.changer) ? row.changer[0] : row.changer;
        return {
          historyId: row.history_id,
          previousStatus: row.previous_status,
          newStatus: row.new_status,
          reason: row.reason,
          changedAt: row.changed_at,
          changedBy: changer
            ? `${changer.first_name} ${changer.last_name}`.trim()
            : "System",
        };
      });

      return successResponse({
        staffId,
        currentStatus: existingStaff.status,
        history,
        totalChanges: history.length,
      });
    } catch (err) {
      return errorResponse(
        err instanceof Error ? err.message : "Failed to load status history.",
        500
      );
    }
  },
);
