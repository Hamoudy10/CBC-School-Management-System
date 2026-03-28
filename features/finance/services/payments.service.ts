// features/finance/services/payments.service.ts
// ============================================================
// Payments CRUD service
// Records payments, generates receipts
// ============================================================

import {
  createSupabaseAdminClient,
  createSupabaseServerClient,
} from "@/lib/supabase/server";
import { hasPermission } from "@/lib/auth/permissions";
import type { AuthUser } from "@/types/auth";
import type {
  Payment,
  PaymentReceiptDetails,
  UpdatePaymentPayload,
} from "../types";
import type {
  CreatePaymentInput,
  PaymentFiltersInput,
  UpdatePaymentInput,
} from "../validators/finance.schema";
import type { PaginatedResponse } from "@/features/users/types";
import { calculateFeeStatus } from "./studentFees.service";

function canBypassSelfApprovalBoundary(currentUser: AuthUser) {
  return ["super_admin", "school_admin", "principal"].includes(currentUser.role);
}

// ============================================================
// GENERATE RECEIPT NUMBER
// ============================================================
export async function generateReceiptNumber(schoolId: string): Promise<string> {
  const supabase = await createSupabaseServerClient();
  const year = new Date().getFullYear();
  const month = String(new Date().getMonth() + 1).padStart(2, "0");

  const { count } = await supabase
    .from("payments")
    .select("id", { count: "exact", head: true })
    .eq("school_id", schoolId)
    .gte("created_at", `${year}-${month}-01`);

  const sequence = String((count || 0) + 1).padStart(5, "0");
  return `RCP-${year}${month}-${sequence}`;
}

async function recalculateStudentFeeBalance(
  supabase: any,
  studentFeeId: string,
  schoolId: string,
): Promise<void> {
  const [{ data: studentFee, error: feeError }, { data: payments, error: paymentError }] =
    await Promise.all([
      supabase
        .from("student_fees")
        .select("id, amount_due, due_date")
        .eq("id", studentFeeId)
        .eq("school_id", schoolId)
        .single(),
      supabase
        .from("payments")
        .select("amount_paid")
        .eq("student_fee_id", studentFeeId)
        .eq("school_id", schoolId),
    ]);

  if (feeError || !studentFee) {
    throw new Error(feeError?.message || "Student fee record not found.");
  }

  if (paymentError) {
    throw new Error(paymentError.message);
  }

  const totalPaid = (payments || []).reduce(
    (sum: number, payment: any) => sum + Number(payment.amount_paid || 0),
    0,
  );
  const amountDue = Number(studentFee.amount_due || 0);
  const nextStatus = calculateFeeStatus(
    amountDue,
    totalPaid,
    studentFee.due_date,
  );

  const { error: updateError } = await supabase
    .from("student_fees")
    .update({
      amount_paid: totalPaid,
      status: nextStatus,
      updated_at: new Date().toISOString(),
    })
    .eq("id", studentFeeId)
    .eq("school_id", schoolId);

  if (updateError) {
    throw new Error(updateError.message);
  }
}

async function getManagedPaymentRecord(paymentId: string, currentUser: AuthUser) {
  const supabase = await createSupabaseAdminClient();

  let query = supabase
    .from("payments")
    .select(
      `
      id,
      school_id,
      student_fee_id,
      amount_paid,
      payment_method,
      transaction_id,
      receipt_number,
      payment_date,
      notes,
      recorded_by,
      student_fees (
        id,
        amount_due,
        amount_paid,
        balance,
        due_date,
        status
      )
    `,
    )
    .eq("id", paymentId);

  if (currentUser.role !== "super_admin") {
    query = query.eq("school_id", currentUser.schoolId!);
  }

  const { data, error } = await query.maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return {
    supabase,
    payment: (data as any) ?? null,
  };
}

// ============================================================
// LIST PAYMENTS
// ============================================================
export async function listPayments(
  filters: PaymentFiltersInput,
  currentUser: AuthUser,
): Promise<PaginatedResponse<Payment>> {
  const supabase = await createSupabaseServerClient();
  const { page, pageSize } = filters;
  const offset = (page - 1) * pageSize;

  let query = supabase.from("payments").select(
    `
      *,
      student_fees (
        student_id,
        students (
          first_name,
          last_name,
          admission_number
        ),
        fee_structures (
          name
        )
      ),
      users!recorded_by (
        first_name,
        last_name
      )
    `,
    { count: "exact" },
  );

  let scopedStudentFeeIds: string[] | null = null;

  // School scoping
  if (currentUser.role !== "super_admin") {
    query = query.eq("school_id", currentUser.schoolId!);
  }

  // Parents see only their children's payments
  if (currentUser.role === "parent") {
    const { data: guardianLinks } = await supabase
      .from("student_guardians")
      .select("student_id")
      .eq("guardian_user_id", currentUser.id);

    const childIds =
      (guardianLinks as any[])?.map((g: any) => g.student_id) || [];
    if (childIds.length === 0) {
      return { data: [], total: 0, page, pageSize, totalPages: 0 };
    }

    // Need to filter by student_fees.student_id
    const { data: studentFees } = await supabase
      .from("student_fees")
      .select("id")
      .in("student_id", childIds);

    const feeIds = (studentFees as any[])?.map((f: any) => f.id) || [];
    if (feeIds.length === 0) {
      return { data: [], total: 0, page, pageSize, totalPages: 0 };
    }
    scopedStudentFeeIds = feeIds;
  }

  if (currentUser.role === "student") {
    const { data: studentRecord } = await supabase
      .from("students")
      .select("student_id")
      .eq("user_id", currentUser.id)
      .maybeSingle();

    const studentId = (studentRecord as any)?.student_id;
    if (!studentId) {
      return { data: [], total: 0, page, pageSize, totalPages: 0 };
    }

    const { data: studentFees } = await supabase
      .from("student_fees")
      .select("id")
      .eq("student_id", studentId);

    const feeIds = (studentFees as any[])?.map((fee: any) => fee.id) || [];
    if (feeIds.length === 0) {
      return { data: [], total: 0, page, pageSize, totalPages: 0 };
    }

    scopedStudentFeeIds = feeIds;
  }

  // Filters
  if (filters.studentFeeId) {
    query = query.eq("student_fee_id", filters.studentFeeId);
  }
  if (filters.studentId) {
    const { data: studentFees } = await supabase
      .from("student_fees")
      .select("id")
      .eq("student_id", filters.studentId);

    const feeIds = (studentFees as any[])?.map((fee: any) => fee.id) || [];
    if (feeIds.length === 0) {
      return { data: [], total: 0, page, pageSize, totalPages: 0 };
    }

    if (scopedStudentFeeIds) {
      const allowedIds = new Set(scopedStudentFeeIds);
      scopedStudentFeeIds = feeIds.filter((feeId) => allowedIds.has(feeId));
    } else {
      scopedStudentFeeIds = feeIds;
    }

    if (scopedStudentFeeIds.length === 0) {
      return { data: [], total: 0, page, pageSize, totalPages: 0 };
    }
  }
  if (filters.paymentMethod) {
    query = query.eq("payment_method", filters.paymentMethod);
  }
  if (filters.startDate) {
    query = query.gte("payment_date", filters.startDate);
  }
  if (filters.endDate) {
    query = query.lte("payment_date", filters.endDate);
  }

  if (scopedStudentFeeIds) {
    query = query.in("student_fee_id", scopedStudentFeeIds);
  }

  query = query
    .order("payment_date", { ascending: false })
    .order("created_at", { ascending: false })
    .range(offset, offset + pageSize - 1);

  const { data, error, count } = await query;

  if (error) {
    throw new Error(`Failed to list payments: ${error.message}`);
  }

  const items: Payment[] = (data || []).map((row: any) => {
    const studentFee = row.student_fees as any;

    return {
      id: row.id,
      schoolId: row.school_id,
      studentFeeId: row.student_fee_id,
      studentId: studentFee?.student_id || undefined,
      studentName: studentFee?.students
        ? `${studentFee.students.first_name} ${studentFee.students.last_name}`
        : undefined,
      studentAdmissionNo: studentFee?.students?.admission_number || undefined,
      feeStructureName: studentFee?.fee_structures?.name || undefined,
      amountPaid: parseFloat(row.amount_paid),
      paymentMethod: row.payment_method,
      transactionId: row.transaction_id,
      receiptNumber: row.receipt_number,
      paymentDate: row.payment_date,
      notes: row.notes,
      recordedBy: row.recorded_by,
      recordedByName: row.users
        ? `${row.users.first_name} ${row.users.last_name}`
        : undefined,
      createdAt: row.created_at,
    };
  });

  const total = count || 0;

  return {
    data: items,
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  };
}

// ============================================================
// GET PAYMENT BY ID
// ============================================================
export async function getPaymentById(
  id: string,
  currentUser: AuthUser,
): Promise<Payment | null> {
  const supabase = await createSupabaseServerClient();

  let query = supabase
    .from("payments")
    .select(
      `
      *,
      student_fees (
        student_id,
        students (
          first_name,
          last_name,
          admission_number
        ),
        fee_structures (
          name
        )
      ),
      users!recorded_by (
        first_name,
        last_name
      )
    `,
    )
    .eq("id", id);

  if (currentUser.role !== "super_admin") {
    query = query.eq("school_id", currentUser.schoolId!);
  }

  if (currentUser.role === "parent") {
    const { data: guardianLinks } = await supabase
      .from("student_guardians")
      .select("student_id")
      .eq("guardian_user_id", currentUser.id);

    const childIds =
      (guardianLinks as any[])?.map((record: any) => record.student_id) || [];
    if (childIds.length === 0) {
      return null;
    }

    const { data: studentFees } = await supabase
      .from("student_fees")
      .select("id")
      .in("student_id", childIds);

    const feeIds =
      (studentFees as any[])?.map((record: any) => record.id) || [];
    if (feeIds.length === 0) {
      return null;
    }

    query = query.in("student_fee_id", feeIds);
  }

  if (currentUser.role === "student") {
    const { data: studentRecord } = await supabase
      .from("students")
      .select("student_id")
      .eq("user_id", currentUser.id)
      .maybeSingle();

    const studentId = (studentRecord as any)?.student_id;
    if (!studentId) {
      return null;
    }

    const { data: studentFees } = await supabase
      .from("student_fees")
      .select("id")
      .eq("student_id", studentId);

    const feeIds =
      (studentFees as any[])?.map((record: any) => record.id) || [];
    if (feeIds.length === 0) {
      return null;
    }

    query = query.in("student_fee_id", feeIds);
  }

  const { data, error } = await query.single();

  if (error || !data) {
    return null;
  }

  const studentFee = (data as any).student_fees as any;

  return {
    id: (data as any).id,
    schoolId: (data as any).school_id,
    studentFeeId: (data as any).student_fee_id,
    studentId: studentFee?.student_id || undefined,
    studentName: studentFee?.students
      ? `${studentFee.students.first_name} ${studentFee.students.last_name}`
      : undefined,
    studentAdmissionNo: studentFee?.students?.admission_number || undefined,
    feeStructureName: studentFee?.fee_structures?.name || undefined,
    amountPaid: parseFloat((data as any).amount_paid),
    paymentMethod: (data as any).payment_method,
    transactionId: (data as any).transaction_id,
    receiptNumber: (data as any).receipt_number,
    paymentDate: (data as any).payment_date,
    notes: (data as any).notes,
    recordedBy: (data as any).recorded_by,
    recordedByName: (data as any).users
      ? `${(data as any).users.first_name} ${(data as any).users.last_name}`
      : undefined,
    createdAt: (data as any).created_at,
  };
}

// ============================================================
// GET PAYMENT RECEIPT DETAILS
// ============================================================
export async function getPaymentReceiptDetails(
  id: string,
  currentUser: AuthUser,
): Promise<PaymentReceiptDetails | null> {
  const supabase = await createSupabaseServerClient();

  let query = supabase
    .from("payments")
    .select(
      `
      id,
      school_id,
      student_fee_id,
      amount_paid,
      payment_method,
      transaction_id,
      receipt_number,
      payment_date,
      notes,
      recorded_by,
      created_at,
      student_fees (
        id,
        student_id,
        amount_due,
        fee_structures (
          name
        ),
        students (
          first_name,
          last_name,
          admission_number,
          classes (
            name
          )
        )
      ),
      users!recorded_by (
        first_name,
        last_name
      )
    `,
    )
    .eq("id", id);

  if (currentUser.role !== "super_admin") {
    query = query.eq("school_id", currentUser.schoolId!);
  }

  if (currentUser.role === "parent") {
    const { data: guardianLinks } = await supabase
      .from("student_guardians")
      .select("student_id")
      .eq("guardian_user_id", currentUser.id);

    const childIds =
      (guardianLinks as any[])?.map((record: any) => record.student_id) || [];
    if (childIds.length === 0) {
      return null;
    }

    const { data: studentFees } = await supabase
      .from("student_fees")
      .select("id")
      .in("student_id", childIds);

    const feeIds =
      (studentFees as any[])?.map((record: any) => record.id) || [];
    if (feeIds.length === 0) {
      return null;
    }

    query = query.in("student_fee_id", feeIds);
  }

  if (currentUser.role === "student") {
    const { data: studentRecord } = await supabase
      .from("students")
      .select("student_id")
      .eq("user_id", currentUser.id)
      .maybeSingle();

    const studentId = (studentRecord as any)?.student_id;
    if (!studentId) {
      return null;
    }

    const { data: studentFees } = await supabase
      .from("student_fees")
      .select("id")
      .eq("student_id", studentId);

    const feeIds =
      (studentFees as any[])?.map((record: any) => record.id) || [];
    if (feeIds.length === 0) {
      return null;
    }

    query = query.in("student_fee_id", feeIds);
  }

  const { data, error } = await query.single();

  if (error || !data) {
    return null;
  }

  const payment = data as any;
  const studentFee = payment.student_fees as any;
  const student = studentFee?.students as any;
  const classInfo = student?.classes as any;

  const { data: relatedPayments } = await supabase
    .from("payments")
    .select("id, amount_paid, payment_date, created_at")
    .eq("student_fee_id", payment.student_fee_id)
    .order("payment_date", { ascending: true })
    .order("created_at", { ascending: true });

  let cumulativePaid = 0;
  for (const relatedPayment of relatedPayments || []) {
    cumulativePaid += Number((relatedPayment as any).amount_paid || 0);
    if ((relatedPayment as any).id === payment.id) {
      break;
    }
  }

  const amountDue = Number(studentFee?.amount_due || 0);
  const balanceAfterPayment = Math.max(0, amountDue - cumulativePaid);

  return {
    id: payment.id,
    studentFeeId: payment.student_fee_id,
    studentId: studentFee?.student_id || undefined,
    studentName: student
      ? `${student.first_name} ${student.last_name}`
      : "Unknown Student",
    studentAdmissionNo: student?.admission_number || "",
    className: classInfo?.name || "N/A",
    feeStructureName: studentFee?.fee_structures?.name || "Fee payment",
    amountPaid: Number(payment.amount_paid || 0),
    paymentMethod: payment.payment_method,
    transactionId: payment.transaction_id,
    receiptNumber: payment.receipt_number || payment.id,
    paymentDate: payment.payment_date,
    notes: payment.notes || null,
    recordedBy: payment.recorded_by,
    recordedByName: payment.users
      ? `${payment.users.first_name} ${payment.users.last_name}`
      : "System",
    recordedAt: payment.created_at,
    balanceAfterPayment,
  };
}

// ============================================================
// CREATE PAYMENT
// ============================================================
export async function createPayment(
  payload: CreatePaymentInput,
  currentUser: AuthUser,
): Promise<{
  success: boolean;
  message: string;
  id?: string;
  receiptNumber?: string;
}> {
  const supabase = await createSupabaseServerClient();

  // Verify student fee exists
  const { data: studentFee, error: feeError } = await supabase
    .from("student_fees")
    .select("id, amount_due, amount_paid, school_id, balance")
    .eq("id", payload.studentFeeId)
    .single();

  if (feeError || !studentFee) {
    return { success: false, message: "Student fee record not found." };
  }

  // School scoping
  if (
    currentUser.role !== "super_admin" &&
    (studentFee as any).school_id !== currentUser.schoolId
  ) {
    return { success: false, message: "Access denied." };
  }

  // Check for overpayment
  if (payload.amountPaid > parseFloat((studentFee as any).balance)) {
    return {
      success: false,
      message: `Amount exceeds balance. Current balance: ${(studentFee as any).balance}`,
    };
  }

  // Check for duplicate transaction ID
  if (payload.transactionId) {
    const { data: existing } = await supabase
      .from("payments")
      .select("id")
      .eq("transaction_id", payload.transactionId)
      .maybeSingle();

    if (existing) {
      return {
        success: false,
        message: "Payment with this transaction ID already exists.",
      };
    }
  }

  // Generate receipt number if not provided
  const receiptNumber =
    payload.receiptNumber ||
    (await generateReceiptNumber((studentFee as any).school_id));

  const { data, error } = await supabase
    .from("payments")
    .insert({
      school_id: (studentFee as any).school_id,
      student_fee_id: payload.studentFeeId,
      amount_paid: payload.amountPaid,
      payment_method: payload.paymentMethod,
      transaction_id: payload.transactionId || null,
      receipt_number: receiptNumber,
      payment_date:
        payload.paymentDate || new Date().toISOString().split("T")[0],
      notes: payload.notes || null,
      recorded_by: currentUser.id,
    } as any)
    .select("id")
    .single();

  if (error) {
    return {
      success: false,
      message: `Payment recording failed: ${error.message}`,
    };
  }

  // Note: student_fees.amount_paid and status are updated via DB trigger

  return {
    success: true,
    message: "Payment recorded successfully.",
    id: (data as any).id,
    receiptNumber,
  };
}

export async function updatePayment(
  paymentId: string,
  payload: UpdatePaymentInput,
  currentUser: AuthUser,
): Promise<{ success: boolean; message: string }> {
  const { supabase, payment } = await getManagedPaymentRecord(paymentId, currentUser);

  if (!payment) {
    return { success: false, message: "Payment not found." };
  }

  const studentFee = payment.student_fees as any;
  if ((studentFee?.status || "") === "waived") {
    return {
      success: false,
      message: "Payments linked to waived fees cannot be adjusted.",
    };
  }

  const schoolId = payment.school_id as string;
  const currentAmount = Number(payment.amount_paid || 0);
  const nextAmount = Number(payload.amountPaid ?? currentAmount);
  const isAmountChange =
    payload.amountPaid !== undefined && nextAmount !== currentAmount;
  const currentPaymentMethod = payment.payment_method;
  const nextPaymentMethod = payload.paymentMethod ?? currentPaymentMethod;
  const currentPaymentDate = payment.payment_date;
  const nextPaymentDate = payload.paymentDate ?? currentPaymentDate;
  const currentNotes = payment.notes ?? null;
  const nextNotes =
    payload.notes !== undefined ? payload.notes || null : currentNotes;
  const amountDue = Number(studentFee?.amount_due || 0);

  if (
    isAmountChange &&
    !hasPermission(currentUser.role, "finance", "approve")
  ) {
    return {
      success: false,
      message:
        "Changing payment amounts requires finance approval permission. You can still update non-financial payment details.",
    };
  }

  if (
    isAmountChange &&
    payment.recorded_by === currentUser.id &&
    !canBypassSelfApprovalBoundary(currentUser)
  ) {
    return {
      success: false,
      message:
        "A different approver must authorize amount changes on payments you recorded.",
    };
  }

  const { data: siblingPayments, error: siblingError } = await supabase
    .from("payments")
    .select("id, amount_paid")
    .eq("student_fee_id", payment.student_fee_id)
    .eq("school_id", schoolId);

  if (siblingError) {
    return { success: false, message: siblingError.message };
  }

  const otherPaymentsTotal = (siblingPayments || []).reduce(
    (sum: number, sibling: any) =>
      sibling.id === paymentId ? sum : sum + Number(sibling.amount_paid || 0),
    0,
  );

  if (otherPaymentsTotal + nextAmount > amountDue) {
    return {
      success: false,
      message: "Adjusted payment would exceed the fee amount due.",
    };
  }

  const nextTransactionId =
    payload.transactionId !== undefined
      ? payload.transactionId || null
      : payment.transaction_id;

  if (
    nextTransactionId &&
    String(nextTransactionId).trim().length > 0 &&
    nextTransactionId !== payment.transaction_id
  ) {
    const { data: existingTransaction } = await supabase
      .from("payments")
      .select("id")
      .eq("transaction_id", nextTransactionId)
      .neq("id", paymentId)
      .maybeSingle();

    if (existingTransaction) {
      return {
        success: false,
        message: "Another payment already uses this transaction ID.",
      };
    }
  }

  const updateData: UpdatePaymentPayload = {};
  if (payload.amountPaid !== undefined) {
    updateData.amountPaid = nextAmount;
  }
  if (payload.paymentMethod !== undefined) {
    updateData.paymentMethod = nextPaymentMethod;
  }
  if (payload.transactionId !== undefined) {
    updateData.transactionId = payload.transactionId;
  }
  if (payload.paymentDate !== undefined) {
    updateData.paymentDate = nextPaymentDate;
  }
  if (payload.notes !== undefined) {
    updateData.notes = nextNotes || undefined;
  }

  const dbUpdate = {
    ...(updateData.amountPaid !== undefined
      ? { amount_paid: updateData.amountPaid }
      : {}),
    ...(updateData.paymentMethod !== undefined
      ? { payment_method: updateData.paymentMethod }
      : {}),
    ...(payload.transactionId !== undefined
      ? { transaction_id: nextTransactionId }
      : {}),
    ...(updateData.paymentDate !== undefined
      ? { payment_date: updateData.paymentDate }
      : {}),
    ...(payload.notes !== undefined ? { notes: nextNotes } : {}),
  };

  const { error: updateError } = await supabase
    .from("payments")
    .update(dbUpdate)
    .eq("id", paymentId)
    .eq("school_id", schoolId);

  if (updateError) {
    return {
      success: false,
      message: `Payment adjustment failed: ${updateError.message}`,
    };
  }

  await recalculateStudentFeeBalance(supabase, payment.student_fee_id, schoolId);

  const changedFields = [
    ...(payload.amountPaid !== undefined ? ["amount_paid"] : []),
    ...(payload.paymentMethod !== undefined ? ["payment_method"] : []),
    ...(payload.transactionId !== undefined ? ["transaction_id"] : []),
    ...(payload.paymentDate !== undefined ? ["payment_date"] : []),
    ...(payload.notes !== undefined ? ["notes"] : []),
  ];

  const { error: auditError } = await supabase.from("audit_logs").insert({
    school_id: schoolId,
    table_name: "payments",
    record_id: payment.id,
    action: "UPDATE",
    performed_by: currentUser.id,
    old_data: {
      amount_paid: currentAmount,
      payment_method: currentPaymentMethod,
      transaction_id: payment.transaction_id,
      receipt_number: payment.receipt_number,
      payment_date: currentPaymentDate,
      notes: currentNotes,
      student_fee_id: payment.student_fee_id,
    },
    new_data: {
      amount_paid: nextAmount,
      payment_method: nextPaymentMethod,
      transaction_id: nextTransactionId,
      receipt_number: payment.receipt_number,
      payment_date: nextPaymentDate,
      notes: nextNotes,
      student_fee_id: payment.student_fee_id,
    },
    details: {
      type: "payment_adjustment",
      changed_fields: changedFields,
      previous_amount: currentAmount,
      adjusted_amount: nextAmount,
      amount_delta: nextAmount - currentAmount,
      student_fee_id: payment.student_fee_id,
      receipt_number: payment.receipt_number,
      transaction_id: nextTransactionId,
      notes: nextNotes,
    },
  });

  if (auditError) {
    console.error("Failed to audit payment adjustment:", auditError);
  }

  return {
    success: true,
    message: "Payment adjusted successfully.",
  };
}

export async function refundPayment(
  paymentId: string,
  reason: string,
  currentUser: AuthUser,
): Promise<{ success: boolean; message: string }> {
  const { supabase, payment } = await getManagedPaymentRecord(paymentId, currentUser);

  if (!payment) {
    return { success: false, message: "Payment not found." };
  }

  const studentFee = payment.student_fees as any;
  if ((studentFee?.status || "") === "waived") {
    return {
      success: false,
      message: "Refunds are blocked for payments linked to waived fees.",
    };
  }

  if (
    payment.recorded_by === currentUser.id &&
    !canBypassSelfApprovalBoundary(currentUser)
  ) {
    return {
      success: false,
      message:
        "A different approver must authorize refunds for payments you recorded.",
    };
  }

  const schoolId = payment.school_id as string;

  const { error: deleteError } = await supabase
    .from("payments")
    .delete()
    .eq("id", paymentId)
    .eq("school_id", schoolId);

  if (deleteError) {
    return {
      success: false,
      message: `Refund failed: ${deleteError.message}`,
    };
  }

  await recalculateStudentFeeBalance(supabase, payment.student_fee_id, schoolId);

  const { error: auditError } = await supabase.from("audit_logs").insert({
    school_id: schoolId,
    table_name: "payments",
    record_id: payment.id,
    action: "DELETE",
    performed_by: currentUser.id,
    old_data: {
      amount_paid: Number(payment.amount_paid || 0),
      payment_method: payment.payment_method,
      transaction_id: payment.transaction_id,
      receipt_number: payment.receipt_number,
      payment_date: payment.payment_date,
      notes: payment.notes,
      student_fee_id: payment.student_fee_id,
    },
    new_data: null,
    details: {
      type: "payment_refund",
      reason,
      refunded_amount: Number(payment.amount_paid || 0),
      student_fee_id: payment.student_fee_id,
      receipt_number: payment.receipt_number,
      transaction_id: payment.transaction_id,
    },
  });

  if (auditError) {
    console.error("Failed to audit payment refund:", auditError);
  }

  return {
    success: true,
    message: "Payment refunded successfully.",
  };
}

// ============================================================
// GET PAYMENTS FOR STUDENT FEE
// ============================================================
export async function getPaymentsForStudentFee(
  studentFeeId: string,
  currentUser: AuthUser,
): Promise<Payment[]> {
  const result = await listPayments(
    {
      studentFeeId,
      page: 1,
      pageSize: 1000,
    },
    currentUser,
  );

  return result.data;
}

// ============================================================
// GET TOTAL PAYMENTS TODAY
// ============================================================
export async function getTotalPaymentsToday(
  currentUser: AuthUser,
): Promise<{ count: number; total: number }> {
  const supabase = await createSupabaseServerClient();
  const today = new Date().toISOString().split("T")[0];

  let query = supabase
    .from("payments")
    .select("amount_paid")
    .eq("payment_date", today);

  if (currentUser.role !== "super_admin") {
    query = query.eq("school_id", currentUser.schoolId!);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Failed to get today's payments: ${error.message}`);
  }

  const payments = data || [];
  const total = payments.reduce(
    (sum, p: any) => sum + parseFloat(p.amount_paid),
    0,
  );

  return {
    count: payments.length,
    total,
  };
}
