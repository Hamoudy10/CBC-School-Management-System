import { createSupabaseAdminClient } from "@/lib/supabase/server";
import type { AuthUser } from "@/types/auth";
import type {
  FinanceExceptionRecord,
  FinanceExceptionSummary,
} from "../types";
import type { FinanceExceptionFiltersInput } from "../validators/finance.schema";
import type { PaginatedResponse } from "@/features/users/types";

const FINANCE_EXCEPTION_TYPES = [
  "fee_waiver",
  "payment_refund",
  "payment_adjustment",
] as const;

type SupportedFinanceExceptionType = (typeof FINANCE_EXCEPTION_TYPES)[number];

type FinanceAuditRow = {
  id: string;
  table_name: string;
  record_id: string | null;
  action: string;
  performed_by: string | null;
  performed_at: string;
  old_data: Record<string, any> | null;
  new_data: Record<string, any> | null;
  details: Record<string, any> | null;
};

type StudentFeeContext = {
  id: string;
  studentId: string | null;
  studentName: string;
  studentAdmissionNo: string | null;
  feeName: string | null;
  invoiceNumber: string | null;
};

function isSupportedFinanceExceptionType(
  value: unknown,
): value is SupportedFinanceExceptionType {
  return FINANCE_EXCEPTION_TYPES.includes(
    value as SupportedFinanceExceptionType,
  );
}

function toNumber(value: unknown, fallback = 0) {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : fallback;
}

function resolveStudentFeeId(row: FinanceAuditRow) {
  if (row.table_name === "student_fees") {
    return row.record_id;
  }

  return (
    row.details?.student_fee_id ??
    row.new_data?.student_fee_id ??
    row.old_data?.student_fee_id ??
    null
  );
}

function resolveExceptionAmount(
  type: SupportedFinanceExceptionType,
  row: FinanceAuditRow,
) {
  if (type === "fee_waiver") {
    return toNumber(
      row.details?.waived_amount ??
        row.old_data?.balance ??
        toNumber(row.old_data?.amount_due) - toNumber(row.old_data?.amount_paid),
    );
  }

  if (type === "payment_refund") {
    return toNumber(
      row.details?.refunded_amount ?? row.old_data?.amount_paid ?? 0,
    );
  }

  return Math.abs(
    toNumber(
      row.details?.amount_delta ??
        toNumber(row.new_data?.amount_paid) - toNumber(row.old_data?.amount_paid),
    ),
  );
}

function buildSummary(
  items: FinanceExceptionRecord[],
): FinanceExceptionSummary {
  return items.reduce<FinanceExceptionSummary>(
    (summary, item) => {
      summary.totalCount += 1;

      if (item.type === "fee_waiver") {
        summary.waiverCount += 1;
        summary.waivedAmount += item.amount;
      } else if (item.type === "payment_refund") {
        summary.refundCount += 1;
        summary.refundedAmount += item.amount;
      } else if (item.type === "payment_adjustment") {
        summary.adjustmentCount += 1;
        summary.adjustedAmountDelta += Math.abs(item.amountDelta ?? item.amount);
      }

      return summary;
    },
    {
      totalCount: 0,
      waiverCount: 0,
      refundCount: 0,
      adjustmentCount: 0,
      waivedAmount: 0,
      refundedAmount: 0,
      adjustedAmountDelta: 0,
    },
  );
}

export async function listFinanceExceptions(
  filters: FinanceExceptionFiltersInput,
  currentUser: AuthUser,
): Promise<
  PaginatedResponse<FinanceExceptionRecord> & {
    summary: FinanceExceptionSummary;
  }
> {
  const supabase = await createSupabaseAdminClient();
  const { page, pageSize, startDate, endDate, studentId, type } = filters;
  const offset = (page - 1) * pageSize;

  let auditQuery = supabase
    .from("audit_logs")
    .select(
      "id, table_name, record_id, action, performed_by, performed_at, old_data, new_data, details",
    )
    .in("table_name", ["student_fees", "payments"])
    .order("performed_at", { ascending: false });

  if (currentUser.role !== "super_admin") {
    auditQuery = auditQuery.eq("school_id", currentUser.schoolId!);
  }

  if (startDate) {
    auditQuery = auditQuery.gte("performed_at", `${startDate}T00:00:00Z`);
  }

  if (endDate) {
    auditQuery = auditQuery.lte("performed_at", `${endDate}T23:59:59Z`);
  }

  const { data: auditRows, error: auditError } = await auditQuery;

  if (auditError) {
    throw new Error(`Failed to list finance exceptions: ${auditError.message}`);
  }

  const filteredAuditRows = ((auditRows || []) as FinanceAuditRow[]).filter(
    (row) => {
      const rowType = row.details?.type;
      return (
        isSupportedFinanceExceptionType(rowType) &&
        (!type || rowType === type)
      );
    },
  );

  const studentFeeIds = Array.from(
    new Set(
      filteredAuditRows
        .map(resolveStudentFeeId)
        .filter((value): value is string => Boolean(value)),
    ),
  );
  const performerIds = Array.from(
    new Set(
      filteredAuditRows
        .map((row) => row.performed_by)
        .filter((value): value is string => Boolean(value)),
    ),
  );

  const [studentFeeResult, performerResult] = await Promise.all([
    studentFeeIds.length > 0
      ? supabase
          .from("student_fees")
          .select(
            `
            id,
            student_id,
            invoice_number,
            students (
              first_name,
              last_name,
              admission_number
            ),
            fee_structures (
              name
            )
          `,
          )
          .in("id", studentFeeIds)
      : Promise.resolve({ data: [], error: null }),
    performerIds.length > 0
      ? supabase
          .from("users")
          .select("user_id, first_name, last_name")
          .in("user_id", performerIds)
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (studentFeeResult.error) {
    throw new Error(
      `Failed to load finance exception fee details: ${studentFeeResult.error.message}`,
    );
  }

  if (performerResult.error) {
    throw new Error(
      `Failed to load finance exception user details: ${performerResult.error.message}`,
    );
  }

  const studentFeeMap = new Map<string, StudentFeeContext>();
  for (const row of (studentFeeResult.data || []) as any[]) {
    const student = row.students as any;
    studentFeeMap.set(row.id, {
      id: row.id,
      studentId: row.student_id ?? null,
      studentName: student
        ? `${student.first_name} ${student.last_name}`.trim()
        : "Unknown Student",
      studentAdmissionNo: student?.admission_number ?? null,
      feeName: row.fee_structures?.name ?? null,
      invoiceNumber: row.invoice_number ?? null,
    });
  }

  const performerMap = new Map<string, string>();
  for (const userRow of (performerResult.data || []) as any[]) {
    performerMap.set(
      userRow.user_id,
      `${userRow.first_name || ""} ${userRow.last_name || ""}`.trim() || "System",
    );
  }

  const items = filteredAuditRows
    .map<FinanceExceptionRecord>((row) => {
      const rowType = row.details?.type as SupportedFinanceExceptionType;
      const studentFeeId = resolveStudentFeeId(row);
      const studentFeeContext = studentFeeId
        ? studentFeeMap.get(studentFeeId)
        : undefined;
      const previousAmount =
        rowType === "payment_adjustment"
          ? toNumber(row.old_data?.amount_paid, 0)
          : null;
      const newAmount =
        rowType === "payment_adjustment"
          ? toNumber(row.new_data?.amount_paid, 0)
          : null;
      const amountDelta =
        rowType === "payment_adjustment" && previousAmount !== null && newAmount !== null
          ? newAmount - previousAmount
          : null;

      return {
        id: row.id,
        type: rowType,
        action: row.action,
        performedAt: row.performed_at,
        performedBy: row.performed_by,
        performedByName: row.performed_by
          ? performerMap.get(row.performed_by) || "System"
          : "System",
        reason:
          row.details?.reason ??
          row.details?.notes ??
          row.new_data?.notes ??
          row.old_data?.notes ??
          null,
        amount: resolveExceptionAmount(rowType, row),
        previousAmount,
        newAmount,
        amountDelta,
        studentFeeId,
        paymentId: row.table_name === "payments" ? row.record_id : null,
        studentId:
          row.details?.student_id ?? studentFeeContext?.studentId ?? null,
        studentName: studentFeeContext?.studentName,
        studentAdmissionNo: studentFeeContext?.studentAdmissionNo ?? null,
        feeName: studentFeeContext?.feeName ?? null,
        invoiceNumber: studentFeeContext?.invoiceNumber ?? null,
        receiptNumber:
          row.details?.receipt_number ??
          row.new_data?.receipt_number ??
          row.old_data?.receipt_number ??
          null,
        transactionId:
          row.details?.transaction_id ??
          row.new_data?.transaction_id ??
          row.old_data?.transaction_id ??
          null,
        changedFields: Array.isArray(row.details?.changed_fields)
          ? row.details?.changed_fields
          : [],
      };
    })
    .filter((item) => !studentId || item.studentId === studentId);

  const total = items.length;
  const paginatedItems = items.slice(offset, offset + pageSize);

  return {
    data: paginatedItems,
    total,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(total / Math.max(1, pageSize))),
    summary: buildSummary(items),
  };
}
