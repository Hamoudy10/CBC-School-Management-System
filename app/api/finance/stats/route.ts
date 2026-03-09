import { NextRequest } from "next/server";
import { withAuth } from "@/lib/api/withAuth";
import { apiSuccess, apiError } from "@/lib/api/response";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  getActiveAcademicYear,
  getActiveTerm,
} from "@/features/settings/services/academicYear.service";
import {
  getCollectionByCategory,
  getCollectionByClass,
  getCollectionTrend,
  getDashboardMetrics,
  getDefaultersList,
} from "@/features/finance";

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

export const GET = withAuth(async (_req: NextRequest, user) => {
  try {
    const [activeYear, activeTerm] = await Promise.all([
      getActiveAcademicYear(user.school_id),
      getActiveTerm(user.school_id),
    ]);

    const academicYearId = activeYear.success
      ? activeYear.data?.id
      : undefined;
    const termId = activeTerm.success ? activeTerm.data?.id : undefined;

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

    const [baseMetrics, defaulters, categories, classes, trend, supabase] =
      await Promise.all([
        getDashboardMetrics({ academicYearId, termId }, currentUser),
        getDefaultersList({ academicYearId, termId }, currentUser, 1, 1000),
        getCollectionByCategory({ academicYearId, termId }, currentUser),
        getCollectionByClass({ academicYearId, termId }, currentUser),
        getCollectionTrend({ academicYearId, termId }, currentUser),
        createSupabaseServerClient(),
      ]);

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
      totalExpected: baseMetrics.totalFeesDue,
      totalCollected: baseMetrics.totalCollected,
      totalBalance: baseMetrics.totalPending + baseMetrics.totalOverdue,
      collectionRate: baseMetrics.collectionRate,
      studentsWithBalance: defaulters.total,
      studentsFullyPaid: baseMetrics.fullyPaidCount,
      todayCollections,
      weekCollections,
      monthCollections,
      paymentMethodBreakdown,
      feeTypeBreakdown: categories.map((item) => ({
        feeType: item.feeStructureName,
        expected: item.totalDue,
        collected: item.totalCollected,
        balance: Math.max(0, item.totalDue - item.totalCollected),
      })),
      gradeBreakdown: classes.map((item) => ({
        grade: item.gradeName || item.className,
        expected: item.totalDue,
        collected: item.totalCollected,
        rate: item.collectionRate,
      })),
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
