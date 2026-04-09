export const dynamic = 'force-dynamic';

import { NextRequest } from "next/server";
import { withAuth } from "@/lib/api/withAuth";
import { apiSuccess, apiError } from "@/lib/api/response";
import {
  getActiveAcademicYear,
  getActiveTerm,
} from "@/features/settings/services/academicYear.service";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getCurrentFinanceSnapshot } from "@/lib/finance/currentObligations";

function getAcademicYearId(value: unknown) {
  const row = value as { academic_year_id?: string; id?: string } | null | undefined;
  return row?.academic_year_id ?? row?.id;
}

function getTermId(value: unknown) {
  const row = value as { term_id?: string; id?: string } | null | undefined;
  return row?.term_id ?? row?.id;
}

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
    const search = searchParams.get("search")?.trim().toLowerCase() ?? "";

    const activeYear = await getActiveAcademicYear(user.school_id);
    const academicYearId = activeYear.success
      ? getAcademicYearId(activeYear.data)
      : undefined;
    const activeTerm = await getActiveTerm(user.school_id);
    const termId = activeTerm.success ? getTermId(activeTerm.data) : undefined;

    if (!academicYearId) {
      return apiSuccess([]);
    }

    const supabase = await createSupabaseServerClient();
    const snapshot = await getCurrentFinanceSnapshot({
      supabase,
      schoolId: user.school_id,
      academicYearId,
      termId,
    });

    const balances = snapshot.students
      .filter((student) => student.totalDue > 0)
      .filter((student) => (hasBalance === "true" ? student.balance > 0 : true))
      .filter((student) => {
        if (!search) {
          return true;
        }

        return [
          student.studentName,
          student.admissionNumber,
          student.className,
          student.gradeName,
        ]
          .join(" ")
          .toLowerCase()
          .includes(search);
      })
      .sort((a, b) => b.balance - a.balance)
      .slice(0, limit)
      .map((student) => ({
        studentId: student.studentId,
        studentName: student.studentName,
        admissionNumber: student.admissionNumber,
        className: student.className,
        gradeName: student.gradeName,
        totalDue: student.totalDue,
        totalPaid: student.totalPaid,
        balance: student.balance,
        status: student.status,
        lastPaymentDate: student.lastPaymentDate,
      }));

    return apiSuccess(balances);
  } catch (error: any) {
    return apiError(error.message || "Failed to load balances", 500);
  }
});
