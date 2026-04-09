export const dynamic = 'force-dynamic';

import { NextRequest } from "next/server";
import { withAuth } from "@/lib/api/withAuth";
import { apiSuccess, apiError } from "@/lib/api/response";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  getActiveAcademicYear,
  getActiveTerm,
} from "@/features/settings/services/academicYear.service";
import { getCollectionTrend } from "@/features/finance";
import { getCurrentFinanceSnapshot } from "@/lib/finance/currentObligations";

function startOfWeek(date: Date) {
  const result = new Date(date);
  const day = result.getDay();
  const diff = (day + 6) % 7;
  result.setDate(result.getDate() - diff);
  result.setHours(0, 0, 0, 0);
  return result;
}

function startOfMonth(date: Date) {
  const result = new Date(date);
  result.setDate(1);
  result.setHours(0, 0, 0, 0);
  return result;
}

function getAcademicYearId(value: unknown) {
  const row = value as { academic_year_id?: string; id?: string } | null | undefined;
  return row?.academic_year_id ?? row?.id;
}

function getTermId(value: unknown) {
  const row = value as { term_id?: string; id?: string } | null | undefined;
  return row?.term_id ?? row?.id;
}

export const GET = withAuth(async (_req: NextRequest, user) => {
  try {
    const [activeYear, activeTerm] = await Promise.all([
      getActiveAcademicYear(user.school_id),
      getActiveTerm(user.school_id),
    ]);

    const academicYearId = activeYear.success
      ? getAcademicYearId(activeYear.data)
      : undefined;
    const termId = activeTerm.success ? getTermId(activeTerm.data) : undefined;

    if (!academicYearId) {
      return apiSuccess({
        totalExpected: 0,
        totalCollected: 0,
        totalBalance: 0,
        collectionRate: 0,
        studentsWithBalance: 0,
        studentsFullyPaid: 0,
        todayCollections: 0,
        weekCollections: 0,
        monthCollections: 0,
        paymentMethodBreakdown: [],
        feeTypeBreakdown: [],
        gradeBreakdown: [],
        monthlyTrend: [],
      });
    }

    const currentUser = {
      id: user.user_id,
      schoolId: user.school_id,
      role: user.role,
    } as any;

    const supabasePromise = createSupabaseServerClient();
    const [supabase, snapshot, trend] = await Promise.all([
      supabasePromise,
      getCurrentFinanceSnapshot({
        supabase: await supabasePromise,
        schoolId: user.school_id,
        academicYearId,
        termId,
      }),
      getCollectionTrend({ academicYearId, termId }, currentUser),
    ]);

    const studentsWithObligations = snapshot.students.filter(
      (student) => student.totalDue > 0,
    );
    const studentsWithBalance = studentsWithObligations.filter(
      (student) => student.balance > 0,
    );
    const studentsFullyPaid = studentsWithObligations.filter(
      (student) => student.balance <= 0,
    );
    const totalExpected = studentsWithObligations.reduce(
      (sum, student) => sum + student.totalDue,
      0,
    );
    const totalCollected = studentsWithObligations.reduce(
      (sum, student) => sum + student.totalPaid,
      0,
    );
    const totalBalance = studentsWithObligations.reduce(
      (sum, student) => sum + student.balance,
      0,
    );
    const collectionRate =
      totalExpected > 0 ? (totalCollected / totalExpected) * 100 : 0;

    const feeTypeMap = new Map<
      string,
      { feeType: string; expected: number; collected: number }
    >();
    for (const obligation of snapshot.obligations) {
      const current = feeTypeMap.get(obligation.feeStructureId) ?? {
        feeType: obligation.feeName,
        expected: 0,
        collected: 0,
      };
      current.expected += obligation.amountDue;
      current.collected += obligation.amountPaid;
      feeTypeMap.set(obligation.feeStructureId, current);
    }

    const gradeMap = new Map<
      string,
      { grade: string; expected: number; collected: number }
    >();
    for (const studentSummary of studentsWithObligations) {
      const key = studentSummary.gradeName || studentSummary.className || "Unassigned";
      const current = gradeMap.get(key) ?? {
        grade: key,
        expected: 0,
        collected: 0,
      };
      current.expected += studentSummary.totalDue;
      current.collected += studentSummary.totalPaid;
      gradeMap.set(key, current);
    }

    const today = new Date();
    const todayIso = today.toISOString().split("T")[0];
    const weekStartIso = startOfWeek(today).toISOString().split("T")[0];
    const monthStartIso = startOfMonth(today).toISOString().split("T")[0];

    const { data: payments } = await supabase
      .from("payments")
      .select("amount_paid, payment_method, payment_date")
      .eq("school_id", user.school_id)
      .gte("payment_date", monthStartIso);

    const paymentRows = payments || [];
    const todayCollections = paymentRows
      .filter((p: any) => p.payment_date === todayIso)
      .reduce((sum: number, p: any) => sum + Number(p.amount_paid || 0), 0);
    const weekCollections = paymentRows
      .filter((p: any) => p.payment_date >= weekStartIso)
      .reduce((sum: number, p: any) => sum + Number(p.amount_paid || 0), 0);
    const monthCollections = paymentRows.reduce(
      (sum: number, p: any) => sum + Number(p.amount_paid || 0),
      0,
    );

    const paymentMethodMap = new Map<string, { amount: number; count: number }>();
    for (const payment of paymentRows) {
      const method = payment.payment_method || "other";
      const entry = paymentMethodMap.get(method) || { amount: 0, count: 0 };
      entry.amount += Number(payment.amount_paid || 0);
      entry.count += 1;
      paymentMethodMap.set(method, entry);
    }

    const paymentMethodBreakdown = Array.from(paymentMethodMap.entries()).map(
      ([method, entry]) => ({
        method,
        amount: Math.round(entry.amount * 100) / 100,
        count: entry.count,
        percentage:
          monthCollections > 0 ? (entry.amount / monthCollections) * 100 : 0,
      }),
    );

    return apiSuccess({
      totalExpected: Math.round(totalExpected * 100) / 100,
      totalCollected: Math.round(totalCollected * 100) / 100,
      totalBalance: Math.round(totalBalance * 100) / 100,
      collectionRate: Math.round(collectionRate * 100) / 100,
      studentsWithBalance: studentsWithBalance.length,
      studentsFullyPaid: studentsFullyPaid.length,
      todayCollections,
      weekCollections,
      monthCollections,
      paymentMethodBreakdown,
      feeTypeBreakdown: Array.from(feeTypeMap.values())
        .map((item) => ({
          feeType: item.feeType,
          expected: Math.round(item.expected * 100) / 100,
          collected: Math.round(item.collected * 100) / 100,
          balance: Math.max(
            0,
            Math.round((item.expected - item.collected) * 100) / 100,
          ),
        }))
        .sort((a, b) => b.balance - a.balance),
      gradeBreakdown: Array.from(gradeMap.values())
        .map((item) => ({
          grade: item.grade,
          expected: Math.round(item.expected * 100) / 100,
          collected: Math.round(item.collected * 100) / 100,
          rate:
            item.expected > 0
              ? Math.round((item.collected / item.expected) * 10000) / 100
              : 0,
        }))
        .sort((a, b) => b.expected - a.expected),
      monthlyTrend: trend.map((item) => ({
        month: item.date,
        collected: item.amount,
        expected: 0,
      })),
    });
  } catch (error: any) {
    return apiError(error.message || "Failed to load finance stats", 500);
  }
});
