import { NextRequest } from "next/server";
import { withAuth } from "@/lib/api/withAuth";
import { apiSuccess, apiError } from "@/lib/api/response";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getActiveAcademicYear } from "@/features/settings/services/academicYear.service";

export const GET = withAuth(async (req: NextRequest, user) => {
  try {
    const { searchParams } = new URL(req.url);
    const limit = Math.min(
      100,
      Math.max(
        1,
        parseInt(
          searchParams.get("limit") ?? searchParams.get("pageSize") ?? "50",
          10,
        ),
      ),
    );
    const hasBalance = searchParams.get("hasBalance");

    const activeYear = await getActiveAcademicYear(user.school_id);
    const academicYearId = activeYear.success
      ? activeYear.data?.id
      : undefined;

    const supabase = await createSupabaseServerClient();
    let query = supabase
      .from("student_fees")
      .select(
        `
        student_id,
        amount_due,
        amount_paid,
        balance,
        status,
        students (
          first_name,
          last_name,
          admission_number,
          classes (
            name,
            grades (
              name
            )
          )
        )
      `,
      )
      .eq("school_id", user.school_id);

    if (academicYearId) {
      query = query.eq("academic_year_id", academicYearId);
    }

    if (hasBalance === "true") {
      query = query.gt("balance", 0);
    }

    const { data, error } = await query.limit(limit * 10);

    if (error) {
      return apiError(error.message, 500);
    }

    const studentMap = new Map<
      string,
      {
        studentId: string;
        studentName: string;
        admissionNumber: string;
        className: string;
        gradeName: string;
        totalDue: number;
        totalPaid: number;
        balance: number;
        status: "paid" | "partial" | "pending" | "overdue";
        lastPaymentDate: string | null;
      }
    >();

    for (const row of data || []) {
      const studentId = (row as any).student_id;
      const student = (row as any).students as any;
      const classInfo = student?.classes as any;
      const existing = studentMap.get(studentId) || {
        studentId,
        studentName: student
          ? `${student.first_name} ${student.last_name}`
          : "Unknown Student",
        admissionNumber: student?.admission_number || "",
        className: classInfo?.name || "",
        gradeName: classInfo?.grades?.name || "",
        totalDue: 0,
        totalPaid: 0,
        balance: 0,
        status: "paid" as const,
        lastPaymentDate: null,
      };

      existing.totalDue += Number((row as any).amount_due || 0);
      existing.totalPaid += Number((row as any).amount_paid || 0);
      existing.balance += Number((row as any).balance || 0);

      const rowStatus = ((row as any).status || "pending") as
        | "paid"
        | "partial"
        | "pending"
        | "overdue";
      if (rowStatus === "overdue") existing.status = "overdue";
      else if (rowStatus === "partial" && existing.status !== "overdue") {
        existing.status = "partial";
      } else if (
        rowStatus === "pending" &&
        existing.status !== "overdue" &&
        existing.status !== "partial"
      ) {
        existing.status = "pending";
      }

      studentMap.set(studentId, existing);
    }

    const balances = Array.from(studentMap.values())
      .filter((student) => (hasBalance === "true" ? student.balance > 0 : true))
      .sort((a, b) => b.balance - a.balance)
      .slice(0, limit);

    return apiSuccess(balances);
  } catch (error: any) {
    return apiError(error.message || "Failed to load balances", 500);
  }
});
