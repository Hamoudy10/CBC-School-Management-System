export const dynamic = 'force-dynamic';

import { NextResponse } from "next/server";
import { withPermission } from "@/lib/api/withAuth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isUuid, splitReference } from "@/lib/mpesa/utils";

export const GET = withPermission("finance", "view", async (request, { user }) => {
  const supabase = await createSupabaseServerClient();
  const { searchParams } = new URL(request.url);
  const rawRef = searchParams.get("ref") || "";
  const { normalized } = splitReference(rawRef);

  if (!normalized) {
    return NextResponse.json(
      { success: false, message: "Missing reference" },
      { status: 400 },
    );
  }

  const schoolScope = user.role !== "super_admin" ? user.schoolId! : null;

  const buildFeePayload = (row: any) => ({
    id: row.id,
    invoiceNumber: row.invoice_number,
    balance: row.balance,
    amountDue: row.amount_due,
    amountPaid: row.amount_paid,
    dueDate: row.due_date,
    feeName: row.fee_structures?.name || null,
    studentId: row.student_id,
  });

  let feeMatches: any[] = [];
  let student: any = null;

  if (isUuid(normalized)) {
    let query = supabase
      .from("student_fees")
      .select(
        `id, invoice_number, balance, amount_due, amount_paid, due_date, student_id, fee_structures ( name ), students ( student_id, first_name, last_name, admission_number )`,
      )
      .eq("id", normalized)
      .limit(1);

    if (schoolScope) {
      query = query.eq("school_id", schoolScope);
    }

    const { data } = await query;
    const fee: any = data?.[0];
    if (fee) {
      feeMatches = [buildFeePayload(fee)];
      student = fee.students
        ? {
            id: fee.students.student_id,
            name: `${fee.students.first_name} ${fee.students.last_name}`,
            admissionNumber: fee.students.admission_number,
          }
        : null;
    }
  }

  if (feeMatches.length === 0) {
    let query = supabase
      .from("student_fees")
      .select(
        `id, invoice_number, balance, amount_due, amount_paid, due_date, student_id, fee_structures ( name ), students ( student_id, first_name, last_name, admission_number )`,
      )
      .eq("invoice_number", normalized)
      .limit(1);

    if (schoolScope) {
      query = query.eq("school_id", schoolScope);
    }

    const { data } = await query;
    const fee: any = data?.[0];
    if (fee) {
      feeMatches = [buildFeePayload(fee)];
      student = fee.students
        ? {
            id: fee.students.student_id,
            name: `${fee.students.first_name} ${fee.students.last_name}`,
            admissionNumber: fee.students.admission_number,
          }
        : null;
    }
  }

  if (feeMatches.length === 0) {
    let studentQuery = supabase
      .from("students")
      .select("student_id, first_name, last_name, admission_number, school_id")
      .eq("admission_number", normalized);

    if (schoolScope) {
      studentQuery = studentQuery.eq("school_id", schoolScope);
    }

    const { data: studentData } = await studentQuery.maybeSingle();

    if (studentData) {
      student = {
        id: studentData.student_id,
        name: `${studentData.first_name} ${studentData.last_name}`,
        admissionNumber: studentData.admission_number,
      };

      let feesQuery = supabase
        .from("student_fees")
        .select(
          `id, invoice_number, balance, amount_due, amount_paid, due_date, student_id, fee_structures ( name )`,
        )
        .eq("student_id", studentData.student_id)
        .gt("balance", 0)
        .order("due_date", { ascending: true, nullsFirst: false });

      if (schoolScope) {
        feesQuery = feesQuery.eq("school_id", schoolScope);
      }

      const { data: fees } = await feesQuery;
      feeMatches = (fees || []).map(buildFeePayload);
    }
  }

  return NextResponse.json({
    success: true,
    message: "Lookup complete",
    data: {
      reference: normalized,
      student,
      fees: feeMatches,
    },
  });
});
