// features/finance/services/payments.service.ts
// ============================================================
// Payments CRUD service
// Records payments, generates receipts
// ============================================================

import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { AuthUser } from "@/types/auth";
import type { Payment } from "../types";
import type {
  CreatePaymentInput,
  PaymentFiltersInput,
} from "../validators/finance.schema";
import type { PaginatedResponse } from "@/features/users/types";

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

    const childIds = (guardianLinks as any[])?.map((g: any) => g.student_id) || [];
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
    query = query.in("student_fee_id", feeIds);
  }

  // Filters
  if (filters.studentFeeId) {
    query = query.eq("student_fee_id", filters.studentFeeId);
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

  const { data, error } = await query.single();

  if (error || !data) return null;

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
  const total = payments.reduce((sum, p: any) => sum + parseFloat(p.amount_paid), 0);

  return {
    count: payments.length,
    total,
  };
}
