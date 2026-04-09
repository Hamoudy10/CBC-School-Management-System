export const dynamic = 'force-dynamic';

import { NextResponse } from "next/server";
import { withPermission } from "@/lib/api/withAuth";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const GET = withPermission("finance", "view", async (request, { user }) => {
  const supabase = await createSupabaseServerClient();
  const { searchParams } = new URL(request.url);

  const status = searchParams.get("status") || "";
  const reconciliationStatus = searchParams.get("reconciliation_status") || "";
  const search = searchParams.get("search") || "";
  const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
  const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get("page_size") || "20", 10)));
  const offset = (page - 1) * pageSize;

  let query = supabase
    .from("mpesa_c2b_transactions")
    .select(
      `
        id,
        school_id,
        student_id,
        student_fee_id,
        payment_id,
        transaction_type,
        trans_id,
        trans_time,
        trans_amount,
        business_short_code,
        bill_ref_number,
        invoice_number,
        msisdn,
        first_name,
        middle_name,
        last_name,
        status,
        reconciliation_status,
        reconciliation_reason,
        created_at,
        students ( student_id, first_name, last_name, admission_number ),
        student_fees ( id, balance, amount_due, amount_paid, fee_structures ( name ) ),
        payments ( id, receipt_number, payment_date )
      `,
      { count: "exact" },
    )
    .order("created_at", { ascending: false });

  if (user.role !== "super_admin") {
    query = query.eq("school_id", user.schoolId!);
  }

  if (status) {
    query = query.eq("status", status);
  }

  if (reconciliationStatus) {
    query = query.eq("reconciliation_status", reconciliationStatus);
  }

  if (search) {
    const term = search.replace(/%/g, "");
    query = query.or(
      `trans_id.ilike.%${term}%,bill_ref_number.ilike.%${term}%,msisdn.ilike.%${term}%`,
    );
  }

  query = query.range(offset, offset + pageSize - 1);

  const { data, error, count } = await query;

  if (error) {
    return NextResponse.json(
      { success: false, message: error.message, data: null },
      { status: 500 },
    );
  }

  const rows = (data || []).map((row: any) => {
    const student = row.students;
    const fee = row.student_fees;
    const payment = row.payments;

    return {
      id: row.id,
      transId: row.trans_id,
      transactionType: row.transaction_type,
      transTime: row.trans_time,
      transAmount: row.trans_amount,
      billRefNumber: row.bill_ref_number,
      invoiceNumber: row.invoice_number,
      msisdn: row.msisdn,
      status: row.status,
      reconciliationStatus: row.reconciliation_status,
      reconciliationReason: row.reconciliation_reason,
      createdAt: row.created_at,
      student: student
        ? {
            id: student.student_id,
            name: `${student.first_name} ${student.last_name}`,
            admissionNumber: student.admission_number,
          }
        : null,
      fee: fee
        ? {
            id: fee.id,
            balance: fee.balance,
            amountDue: fee.amount_due,
            amountPaid: fee.amount_paid,
            feeName: fee.fee_structures?.name || null,
          }
        : null,
      payment: payment
        ? {
            id: payment.id,
            receiptNumber: payment.receipt_number,
            paymentDate: payment.payment_date,
          }
        : null,
    };
  });

  return NextResponse.json({
    success: true,
    message: "M-Pesa transactions loaded",
    data: {
      items: rows,
      total: count || 0,
      page,
      pageSize,
      totalPages: Math.ceil((count || 0) / pageSize),
    },
  });
});
