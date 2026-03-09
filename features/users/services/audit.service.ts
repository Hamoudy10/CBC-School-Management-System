// features/users/services/audit.service.ts
// ============================================================
// Audit trail query service for User Management module
// Read-only — audit logs are written by DB triggers and app services
// ============================================================

import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { AuthUser } from "@/types/auth";
import type { AuditTrailEntry, PaginatedResponse } from "../types";
import type { AuditTrailFiltersInput } from "../validators/user.schema";

// ============================================================
// LIST AUDIT TRAIL ENTRIES (paginated, filtered)
// ============================================================
export async function listAuditTrail(
  filters: AuditTrailFiltersInput,
  currentUser: AuthUser,
): Promise<PaginatedResponse<AuditTrailEntry>> {
  const supabase = await createSupabaseServerClient();

  const { page, pageSize, userId, action, tableName, startDate, endDate } =
    filters;
  const offset = (page - 1) * pageSize;

  let query = supabase.from("audit_logs").select("*", { count: "exact" });

  // School scoping (RLS handles this, but defense in depth)
  if (currentUser.role !== "super_admin") {
    query = query.eq("school_id", currentUser.schoolId!);
  }

  // Filters
  if (userId) {
    query = query.eq("performed_by", userId);
  }
  if (action) {
    query = query.eq("action", action);
  }
  if (tableName) {
    query = query.eq("table_name", tableName);
  }
  if (startDate) {
    query = query.gte("performed_at", `${startDate}T00:00:00Z`);
  }
  if (endDate) {
    query = query.lte("performed_at", `${endDate}T23:59:59Z`);
  }

  // Sort and paginate
  query = query
    .order("performed_at", { ascending: false })
    .range(offset, offset + pageSize - 1);

  const { data, error, count } = await query;

  if (error) {
    throw new Error(`Failed to list audit trail: ${error.message}`);
  }

  const entries: AuditTrailEntry[] = (data || []).map((row: any) => ({
    id: row.id,
    schoolId: row.school_id,
    tableName: row.table_name,
    recordId: row.record_id,
    action: row.action,
    performedBy: row.performed_by,
    performedAt: row.performed_at,
    ipAddress: row.ip_address,
    oldData: row.old_data,
    newData: row.new_data,
    details: row.details,
  }));

  const total = count || 0;

  return {
    data: entries,
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  };
}

// ============================================================
// GET AUDIT TRAIL FOR SPECIFIC USER
// ============================================================
export async function getAuditTrailForUser(
  targetUserId: string,
  currentUser: AuthUser,
  page = 1,
  pageSize = 20,
): Promise<PaginatedResponse<AuditTrailEntry>> {
  return listAuditTrail(
    {
      userId: targetUserId,
      tableName: "users",
      page,
      pageSize,
    },
    currentUser,
  );
}

// ============================================================
// GET RECENT AUDIT ENTRIES (for dashboard widget)
// ============================================================
export async function getRecentAuditEntries(
  currentUser: AuthUser,
  limit = 10,
): Promise<AuditTrailEntry[]> {
  const result = await listAuditTrail(
    {
      page: 1,
      pageSize: limit,
    },
    currentUser,
  );

  return result.data;
}
