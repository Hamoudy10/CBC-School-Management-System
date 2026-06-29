export const dynamic = 'force-dynamic';

import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { isValidMpesaOrigin, normalizeC2BPayload } from "@/lib/mpesa/utils";

function mpesaResponse(resultCode: number, resultDesc: string) {
  return NextResponse.json({ ResultCode: resultCode, ResultDesc: resultDesc });
}

export async function POST(request: Request) {
  if (!isValidMpesaOrigin(request)) {
    return mpesaResponse(1, "Forbidden");
  }

  let payload: any = null;

  try {
    payload = await request.json();
  } catch (error) {
    console.error("M-Pesa validation invalid JSON:", error);
    return mpesaResponse(1, "Invalid JSON payload");
  }

  const normalized = normalizeC2BPayload(payload || {});

  const supabase = await createSupabaseAdminClient();

  const hasCriticalIssues = !normalized.transId || normalized.transAmount <= 0;
  const hasReference = !!(normalized.billRefNumber || normalized.invoiceNumber);

  const status = hasCriticalIssues
    ? "failed"
    : hasReference
      ? "validated"
      : "manual_review";

  const validationDesc = hasCriticalIssues
    ? "Rejected: missing transaction details"
    : hasReference
      ? "Accepted"
      : "Accepted: missing bill reference";

  const { data: existing } = await supabase
    .from("mpesa_c2b_transactions")
    .select("id")
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
    status,
    validation_result_code: hasCriticalIssues ? 1 : 0,
    validation_result_desc: validationDesc,
    raw_payload: normalized.raw,
  };

  if (existing) {
    await supabase
      .from("mpesa_c2b_transactions")
      .update(basePayload)
      .eq("id", existing.id);
  } else {
    await supabase.from("mpesa_c2b_transactions").insert(basePayload);
  }

  // Audit log for validation
  const auditPayload = {
    school_id: defaultSchoolId,
    table_name: "mpesa_c2b_transactions",
    record_id: existing?.id || "pending_insert",
    action: "MPESA_VALIDATION",
    performed_by: "MPESA_SYSTEM",
    old_data: null,
    new_data: { trans_id: normalized.transId, trans_amount: normalized.transAmount, status },
    details: {
      type: "mpesa_c2b_validation",
      trans_id: normalized.transId,
      trans_amount: normalized.transAmount,
      bill_ref_number: normalized.billRefNumber,
      invoice_number: normalized.invoiceNumber,
      msisdn: normalized.msisdn,
      result_code: hasCriticalIssues ? 1 : 0,
      result_desc: validationDesc,
    },
  };
  try { await supabase.from("audit_logs").insert(auditPayload); } catch {} 

  if (hasCriticalIssues) {
    return mpesaResponse(1, validationDesc);
  }

  return mpesaResponse(0, validationDesc);
}
