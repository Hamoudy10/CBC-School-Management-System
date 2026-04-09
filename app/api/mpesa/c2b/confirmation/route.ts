export const dynamic = 'force-dynamic';

import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { normalizeC2BPayload } from "@/lib/mpesa/utils";
import { autoReconcileC2BTransaction } from "@/lib/mpesa/reconcile";

function mpesaResponse(resultCode: number, resultDesc: string) {
  return NextResponse.json({ ResultCode: resultCode, ResultDesc: resultDesc });
}

export async function POST(request: Request) {
  let payload: any = null;

  try {
    payload = await request.json();
  } catch (error) {
    console.error("M-Pesa confirmation invalid JSON:", error);
    return mpesaResponse(1, "Invalid JSON payload");
  }

  const normalized = normalizeC2BPayload(payload || {});
  const supabase = await createSupabaseAdminClient();

  const { data: existing } = await supabase
    .from("mpesa_c2b_transactions")
    .select("id, payment_id")
    .eq("trans_id", normalized.transId)
    .maybeSingle();

  const defaultSchoolId = process.env.MPESA_DEFAULT_SCHOOL_ID || null;
  const basePayload = {
    school_id: defaultSchoolId,
    transaction_type: normalized.transactionType,
    trans_id: normalized.transId,
    trans_time: normalized.transTime,
    trans_amount: normalized.transAmount,
    business_short_code: normalized.businessShortCode,
    bill_ref_number: normalized.billRefNumber,
    invoice_number: normalized.invoiceNumber,
    org_account_balance: normalized.orgAccountBalance,
    third_party_trans_id: normalized.thirdPartyTransId,
    msisdn: normalized.msisdn,
    first_name: normalized.firstName,
    middle_name: normalized.middleName,
    last_name: normalized.lastName,
    status: "confirmed",
    confirmation_result_code: 0,
    confirmation_result_desc: "Confirmed",
    raw_payload: normalized.raw,
  };

  let recordId = existing?.id as string | undefined;

  if (recordId) {
    await supabase
      .from("mpesa_c2b_transactions")
      .update(basePayload)
      .eq("id", recordId);
  } else {
    const { data: inserted } = await supabase
      .from("mpesa_c2b_transactions")
      .insert(basePayload)
      .select("id")
      .single();

    recordId = inserted?.id;
  }

  if (!recordId) {
    return mpesaResponse(1, "Failed to record transaction");
  }

  if (existing?.payment_id) {
    return mpesaResponse(0, "Already reconciled");
  }

  const reconcileResult = await autoReconcileC2BTransaction(
    {
      supabase,
      systemUserId: process.env.MPESA_SYSTEM_USER_ID || null,
    },
    {
      id: recordId,
      transId: normalized.transId,
      transAmount: normalized.transAmount,
      transTime: normalized.transTime,
      billRefNumber: normalized.billRefNumber,
      invoiceNumber: normalized.invoiceNumber,
    },
  );

  const updatePayload: Record<string, any> = {
    status: reconcileResult.status === "reconciled" ? "reconciled" : "manual_review",
    reconciliation_status:
      reconcileResult.status === "reconciled" ? "auto" : "pending",
    reconciliation_reason: reconcileResult.reason || null,
  };

  if (reconcileResult.status === "reconciled") {
    updatePayload.payment_id = reconcileResult.paymentId;
    updatePayload.student_id = reconcileResult.studentId || null;
    updatePayload.student_fee_id = reconcileResult.studentFeeId || null;
    updatePayload.school_id = reconcileResult.schoolId || null;
    updatePayload.reconciled_at = new Date().toISOString();
    updatePayload.reconciled_by = process.env.MPESA_SYSTEM_USER_ID || null;
  }

  await supabase
    .from("mpesa_c2b_transactions")
    .update(updatePayload)
    .eq("id", recordId);

  return mpesaResponse(0, "Confirmation received");
}
