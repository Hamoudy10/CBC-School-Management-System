export const dynamic = 'force-dynamic';

import { NextResponse } from "next/server";
import { z } from "zod";
import { withPermission } from "@/lib/api/withAuth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createPayment } from "@/features/finance";

const reconcileSchema = z.object({
  transactionId: z.string().uuid(),
  studentFeeId: z.string().uuid(),
});

export const POST = withPermission("finance", "update", async (request, { user }) => {
  const supabase = await createSupabaseServerClient();

  let body: any = null;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { success: false, message: "Invalid JSON body" },
      { status: 400 },
    );
  }

  const parsed = reconcileSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, message: "Validation failed", errors: parsed.error.errors },
      { status: 400 },
    );
  }

  const { transactionId, studentFeeId } = parsed.data;

  const { data: tx, error } = await supabase
    .from("mpesa_c2b_transactions")
    .select("id, trans_id, trans_amount, payment_id, status")
    .eq("id", transactionId)
    .single();

  if (error || !tx) {
    return NextResponse.json(
      { success: false, message: "Transaction not found" },
      { status: 404 },
    );
  }

  if (tx.payment_id) {
    return NextResponse.json({
      success: true,
      message: "Transaction already reconciled",
      data: { paymentId: tx.payment_id },
    });
  }

  const result = await createPayment(
    {
      studentFeeId,
      amountPaid: tx.trans_amount,
      paymentMethod: "mpesa",
      transactionId: tx.trans_id,
      notes: "Manual M-Pesa reconciliation",
    },
    user,
  );

  if (!result.success || !result.id) {
    return NextResponse.json(
      { success: false, message: result.message || "Failed to reconcile" },
      { status: 400 },
    );
  }

  await supabase
    .from("mpesa_c2b_transactions")
    .update({
      payment_id: result.id,
      status: "reconciled",
      reconciliation_status: "manual",
      reconciled_at: new Date().toISOString(),
      reconciled_by: user.id,
      reconciliation_reason: null,
    })
    .eq("id", transactionId);

  return NextResponse.json({
    success: true,
    message: "Transaction reconciled",
    data: { paymentId: result.id },
  });
});
