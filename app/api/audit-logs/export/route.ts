export const dynamic = 'force-dynamic';

// app/api/audit-logs/export/route.ts
// ============================================================
// GET /api/audit-logs/export - Export audit logs as CSV
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { withPermission } from "@/lib/api/withAuth";
import { errorResponse } from "@/lib/api/response";
import { createSupabaseServerClient } from "@/lib/supabase/server";

function escapeCSV(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export const GET = withPermission(
  "audit_logs",
  "view",
  async (request: NextRequest, { user }) => {
    try {
      const supabase = await createSupabaseServerClient();

      if (!user.schoolId) {
        return errorResponse("School context is required.", 400);
      }

      const { data, error } = await supabase
        .from("audit_logs")
        .select(
          `
          id,
          table_name,
          record_id,
          action,
          performed_at,
          changes_json,
          users!audit_logs_performed_by_fkey (
            first_name,
            last_name,
            email
          )
        `
        )
        .eq("school_id", user.schoolId)
        .order("performed_at", { ascending: false })
        .limit(5000);

      if (error) {
        return errorResponse(`Failed to load audit logs: ${error.message}`, 500);
      }

      const headers = [
        "Timestamp",
        "Action",
        "Table",
        "Record ID",
        "Performed By",
        "Email",
        "Changes",
      ];

      const rows = (data ?? []).map((row: any) => {
        const performer = Array.isArray(row.users) ? row.users[0] : row.users;
        return [
          escapeCSV(row.performed_at ?? ""),
          escapeCSV(row.action ?? ""),
          escapeCSV(row.table_name ?? ""),
          escapeCSV(row.record_id ?? ""),
          escapeCSV(performer ? `${performer.first_name} ${performer.last_name}`.trim() : ""),
          escapeCSV(performer?.email ?? ""),
          escapeCSV(row.changes_json ? JSON.stringify(row.changes_json) : ""),
        ].join(",");
      });

      const csv = [headers.join(","), ...rows].join("\n");

      return new NextResponse(csv, {
        status: 200,
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": 'attachment; filename="audit-logs.csv"',
        },
      });
    } catch (err) {
      return errorResponse(
        err instanceof Error ? err.message : "Failed to export audit logs.",
        500,
      );
    }
  },
);
