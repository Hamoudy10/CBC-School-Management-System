// services/audit.service.ts
// ============================================================
// Audit logging service for application-level events
// Database triggers handle data-level auditing
// This service handles: login attempts, role changes, config changes
// ============================================================

import { createSupabaseServerClient } from "@/lib/supabase/server";

// ============================================================
// Audit Action Types (matches DB enum)
// ============================================================
export type AuditAction =
  | "INSERT"
  | "UPDATE"
  | "DELETE"
  | "LOGIN"
  | "LOGOUT"
  | "FAILED_LOGIN"
  | "ROLE_CHANGE"
  | "CONFIG_CHANGE"
  | "PROMOTION"
  | "PAYMENT";

// ============================================================
// Audit Log Entry
// ============================================================
export interface AuditEntry {
  schoolId?: string | null;
  tableName: string;
  recordId?: string | null;
  action: AuditAction;
  performedBy?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  oldData?: Record<string, any> | null;
  newData?: Record<string, any> | null;
  details?: Record<string, any> | null;
}

// ============================================================
// Write audit log entry
// ============================================================
export async function writeAuditLog(entry: AuditEntry): Promise<void> {
  try {
    const supabase = await createSupabaseServerClient();

    const { error } = await supabase.from("audit_logs").insert({
      school_id: entry.schoolId,
      table_name: entry.tableName,
      record_id: entry.recordId,
      action: entry.action,
      performed_by: entry.performedBy,
      ip_address: entry.ipAddress,
      user_agent: entry.userAgent,
      old_data: entry.oldData,
      new_data: entry.newData,
      details: entry.details,
    });

    if (error) {
      // Audit logging failures should never break the app
      // But must be logged for monitoring
      console.error("CRITICAL: Failed to write audit log:", error);
    }
  } catch (error) {
    console.error("CRITICAL: Audit log service error:", error);
  }
}

// ============================================================
// Convenience: Log login attempt
// ============================================================
export async function logLoginAttempt(
  email: string,
  success: boolean,
  userId?: string,
  schoolId?: string,
  ipAddress?: string,
  userAgent?: string,
): Promise<void> {
  await writeAuditLog({
    schoolId,
    tableName: "users",
    recordId: userId,
    action: success ? "LOGIN" : "FAILED_LOGIN",
    performedBy: userId,
    ipAddress,
    userAgent,
    details: { email, success },
  });
}

// ============================================================
// Convenience: Log role change
// ============================================================
export async function logRoleChange(
  targetUserId: string,
  oldRole: string,
  newRole: string,
  performedBy: string,
  schoolId: string,
): Promise<void> {
  await writeAuditLog({
    schoolId,
    tableName: "users",
    recordId: targetUserId,
    action: "ROLE_CHANGE",
    performedBy,
    oldData: { role: oldRole },
    newData: { role: newRole },
    details: { target_user_id: targetUserId },
  });
}

// ============================================================
// Convenience: Log configuration change
// ============================================================
export async function logConfigChange(
  tableName: string,
  recordId: string,
  oldData: Record<string, any>,
  newData: Record<string, any>,
  performedBy: string,
  schoolId: string,
): Promise<void> {
  await writeAuditLog({
    schoolId,
    tableName,
    recordId,
    action: "CONFIG_CHANGE",
    performedBy,
    oldData,
    newData,
  });
}
