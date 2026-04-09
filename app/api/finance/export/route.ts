export const dynamic = 'force-dynamic';

import { NextResponse } from "next/server";
import { withPermission } from "@/lib/api/withAuth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getActiveAcademicYear } from "@/features/settings/services/academicYear.service";

function escapeCsv(value: unknown) {
  const stringValue = String(value ?? "");
  if (stringValue.includes(",") || stringValue.includes("\"") || stringValue.includes("\n")) {
    return `"${stringValue.replace(/"/g, "\"\"")}"`;
  }

  return stringValue;
}

export const GET = withPermission("finance", "export", async (_request, { user }) => {
  const supabase = await createSupabaseServerClient();
  const activeYear = await getActiveAcademicYear(user.schoolId!);
  const academicYearId = activeYear.success ? activeYear.data?.id : null;

  let query = supabase
    .from("student_fees")
    .select(
      `
      amount_due,
      amount_paid,
      balance,
      status,
      invoice_number,
      due_date,
      students(first_name, last_name, admission_number),
      fee_structures(name),
      terms(name)
    `,
    )
    .eq("school_id", user.schoolId!);

  if (academicYearId) {
    query = query.eq("academic_year_id", academicYearId);
  }

  const { data, error } = await query.order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json(
      { success: false, error: error.message, data: null },
      { status: 500 },
    );
  }

  const rows = [
    [
      "Invoice Number",
      "Student",
      "Admission Number",
      "Fee",
      "Term",
      "Amount Due",
      "Amount Paid",
      "Balance",
      "Status",
      "Due Date",
    ].join(","),
    ...(data ?? []).map((row: any) =>
      [
        escapeCsv(row.invoice_number),
        escapeCsv(`${row.students?.first_name ?? ""} ${row.students?.last_name ?? ""}`.trim()),
        escapeCsv(row.students?.admission_number),
        escapeCsv(row.fee_structures?.name),
        escapeCsv(row.terms?.name),
        escapeCsv(row.amount_due),
        escapeCsv(row.amount_paid),
        escapeCsv(row.balance),
        escapeCsv(row.status),
        escapeCsv(row.due_date),
      ].join(","),
    ),
  ];

  return new NextResponse(rows.join("\n"), {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="finance-export-${new Date()
        .toISOString()
        .split("T")[0]}.csv"`,
    },
  });
});
