export const dynamic = 'force-dynamic';

import { NextRequest } from "next/server";
import { withAuth } from "@/lib/api/withAuth";
import { apiSuccess, apiError } from "@/lib/api/response";
import { listPayments } from "@/features/finance";

export const GET = withAuth(async (req: NextRequest, user) => {
  try {
    const { searchParams } = new URL(req.url);
    const limit = Math.min(
      100,
      Math.max(1, parseInt(searchParams.get("limit") ?? "10", 10)),
    );

    const payments = await listPayments(
      {
        page: 1,
        pageSize: limit,
      },
      {
        id: user.user_id,
        schoolId: user.school_id,
        role: user.role,
      } as any,
    );

    return apiSuccess(
      (payments.data || []).map((payment: any) => ({
        id: payment.id,
        studentId: payment.studentId || null,
        studentName: payment.studentName || "Unknown Student",
        admissionNumber: payment.studentAdmissionNo || "",
        className: "",
        amount: payment.amountPaid || 0,
        paymentMethod: payment.paymentMethod || "other",
        receiptNumber: payment.receiptNumber || "",
        feeName: payment.feeStructureName || "",
        paymentDate: payment.paymentDate || payment.createdAt || "",
        recordedBy: payment.recordedByName || "",
      })),
    );
  } catch (error: any) {
    return apiError(error.message || "Failed to load recent payments", 500);
  }
});
