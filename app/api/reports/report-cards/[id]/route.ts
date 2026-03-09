// app/api/report-cards/[id]/route.ts
// ============================================================
// GET /api/report-cards/:id - Get report card details
// PUT /api/report-cards/:id - Update report card remarks
// ============================================================

import { NextRequest } from "next/server";
import { withPermission, withAuth } from "@/lib/api/withAuth";
import { validateBody, validateUuid } from "@/lib/api/validation";
import {
  successResponse,
  errorResponse,
  notFoundResponse,
  validationErrorResponse,
  forbiddenResponse,
} from "@/lib/api/response";
import {
  getReportCardById,
  updateReportCardRemarks,
  updateReportCardRemarksSchema,
} from "@/features/assessments";
import { createSupabaseServerClient } from "@/lib/supabase/server";

// ============================================================
// GET Handler - Get Report Card
// ============================================================
export const GET = withAuth(async (request, { user, params }) => {
  const id = params?.id;
  if (!id) return notFoundResponse("Report card ID required");

  const validation = validateUuid(id);
  if (!validation.success) {
    return validationErrorResponse(validation.errors!);
  }

  const reportCard = await getReportCardById(id, user);

  if (!reportCard) {
    return notFoundResponse("Report card not found");
  }

  // Parents can only see their children's published reports
  if (user.role === "parent") {
    if (!reportCard.isPublished) {
      return forbiddenResponse("Report card is not yet published");
    }

    const supabase = await createSupabaseServerClient();
    const { data: guardianLinks } = await (supabase.from("student_guardians") as any)
      .select("student_id")
      .eq("guardian_user_id", user.id);

    const childIds = guardianLinks?.map((g: any) => g.student_id) || [];
    if (!childIds.includes(reportCard.studentId)) {
      return forbiddenResponse("You can only view your own children's reports");
    }
  }

  // Students can only see their own published reports
  if (user.role === "student") {
    if (!reportCard.isPublished) {
      return forbiddenResponse("Report card is not yet published");
    }

    const supabase = await createSupabaseServerClient();
    const { data: studentRecord } = await (supabase.from("students") as any)
      .select("student_id")
      .eq("user_id", user.id)
      .single();

    if (studentRecord?.student_id !== reportCard.studentId) {
      return forbiddenResponse("You can only view your own reports");
    }
  }

  return successResponse(reportCard);
});

// ============================================================
// PUT Handler - Update Report Card Remarks
// ============================================================
export const PUT = withPermission(
  "reports",
  "update",
  async (request, { user, params }) => {
    const id = params?.id;
    if (!id) return notFoundResponse("Report card ID required");

    const idValidation = validateUuid(id);
    if (!idValidation.success) {
      return validationErrorResponse(idValidation.errors!);
    }

    const bodyValidation = await validateBody(
      request,
      updateReportCardRemarksSchema,
    );
    if (!bodyValidation.success) {
      return validationErrorResponse(bodyValidation.errors!);
    }

    const result = await updateReportCardRemarks(
      id,
      bodyValidation.data!,
      user,
    );

    if (!result.success) {
      return errorResponse(result.message);
    }

    return successResponse({ message: result.message });
  },
);
