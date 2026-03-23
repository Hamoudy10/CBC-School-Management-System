import { NextRequest } from "next/server";
import { z } from "zod";
import { withAuth, withPermission } from "@/lib/api/withAuth";
import {
  createdResponse,
  errorResponse,
  successResponse,
  validationErrorResponse,
} from "@/lib/api/response";
import { validateQuery } from "@/lib/api/validation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createPayment, listPayments } from "@/features/finance";

const paymentFiltersSchema = z.object({
  studentFeeId: z.string().uuid().optional(),
  studentId: z.string().uuid().optional(),
  paymentMethod: z
    .enum(["cash", "bank_transfer", "mpesa", "cheque", "other"])
    .optional(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

const createPaymentSchema = z.object({
  studentFeeId: z.string().uuid(),
  amountPaid: z.coerce.number().positive(),
  paymentMethod: z.enum(["cash", "bank_transfer", "mpesa", "cheque", "other"]),
  transactionId: z.string().max(100).nullish(),
  receiptNumber: z.string().max(100).nullish(),
  paymentDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  notes: z.string().max(500).nullish(),
});

function normalizePayment(row: any) {
  return {
    id: row.id,
    payment_id: row.id,
    studentFeeId: row.studentFeeId,
    student_fee_id: row.studentFeeId,
    studentId: row.studentId ?? null,
    student_id: row.studentId ?? null,
    studentName: row.studentName ?? null,
    student_name: row.studentName ?? null,
    admissionNumber: row.studentAdmissionNo ?? null,
    admission_number: row.studentAdmissionNo ?? null,
    feeName: row.feeStructureName ?? null,
    fee_name: row.feeStructureName ?? null,
    amountPaid: row.amountPaid,
    amount_paid: row.amountPaid,
    paymentMethod: row.paymentMethod,
    payment_method: row.paymentMethod,
    transactionId: row.transactionId ?? null,
    transaction_id: row.transactionId ?? null,
    receiptNumber: row.receiptNumber ?? null,
    receipt_number: row.receiptNumber ?? null,
    paymentDate: row.paymentDate,
    payment_date: row.paymentDate,
    notes: row.notes ?? null,
    recordedBy: row.recordedBy ?? null,
    recorded_by: row.recordedBy ?? null,
    recordedByName: row.recordedByName ?? null,
    recorded_by_name: row.recordedByName ?? null,
    createdAt: row.createdAt,
    created_at: row.createdAt,
  };
}

export const GET = withAuth(async (request: NextRequest, { user }) => {
  const { searchParams } = new URL(request.url);

  const validation = validateQuery(
    new URLSearchParams(
      Array.from(searchParams.entries()).map(([key, value]) => {
        const mappedKey =
          key === "student_fee_id"
            ? "studentFeeId"
            : key === "student_id"
              ? "studentId"
              : key === "payment_method"
                ? "paymentMethod"
                : key === "date_from"
                  ? "startDate"
                  : key === "date_to"
                    ? "endDate"
                    : key === "page_size"
                      ? "pageSize"
                      : key;
        return [mappedKey, value];
      }),
    ),
    paymentFiltersSchema,
  );

  if (!validation.success) {
    return validationErrorResponse(validation.errors!);
  }

  const result = await listPayments(validation.data!, user);

  return successResponse(result.data.map(normalizePayment), {
    page: result.page,
    pageSize: result.pageSize,
    total: result.total,
    totalPages: result.totalPages,
  });
});

export const POST = withPermission("finance", "create", async (request) => {
  let body: Record<string, unknown>;

  try {
    body = await request.json();
  } catch {
    return errorResponse("Invalid JSON body", 400);
  }

  const normalizedPayload = {
    studentFeeId: body.studentFeeId ?? body.student_fee_id,
    amountPaid: body.amountPaid ?? body.amount ?? body.amount_paid,
    paymentMethod: body.paymentMethod ?? body.payment_method,
    transactionId: body.transactionId ?? body.transaction_id ?? body.payment_reference,
    receiptNumber: body.receiptNumber ?? body.receipt_number,
    paymentDate: body.paymentDate ?? body.payment_date,
    notes: body.notes,
  };

  const parsed = createPaymentSchema.safeParse(normalizedPayload);

  if (!parsed.success) {
    const errors = parsed.error.errors.map((error) => ({
      field: error.path.join("."),
      message: error.message,
    }));

    return validationErrorResponse(
      errors.reduce<Record<string, string[]>>((acc, error) => {
        acc[error.field] = [...(acc[error.field] ?? []), error.message];
        return acc;
      }, {}),
    );
  }

  const paymentPayload = {
    ...parsed.data,
    transactionId: parsed.data.transactionId ?? undefined,
    receiptNumber: parsed.data.receiptNumber ?? undefined,
    notes: parsed.data.notes ?? undefined,
  };

  const supabase = await createSupabaseServerClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();

  if (!authUser) {
    return errorResponse("Unauthorized", 401);
  }

  const { data: appUser } = await supabase
    .from("users")
    .select("user_id, school_id, first_name, last_name, roles(name)")
    .eq("user_id", authUser.id)
    .single();

  if (!appUser?.school_id) {
    return errorResponse("Forbidden", 403);
  }

  const currentUser = {
    id: appUser.user_id,
    schoolId: appUser.school_id,
    role: (appUser.roles as any)?.name ?? "finance_officer",
  } as any;

  const result = await createPayment(paymentPayload, currentUser);

  if (!result.success) {
    return errorResponse(result.message, 400);
  }

  const payment = await supabase
    .from("payments")
    .select(
      `
      id,
      amount_paid,
      payment_method,
      transaction_id,
      receipt_number,
      payment_date,
      notes,
      created_at
    `,
    )
    .eq("id", result.id)
    .single();

  return createdResponse({
    id: result.id,
    receiptNumber: result.receiptNumber,
    payment: payment.data,
    message: result.message,
  });
});
