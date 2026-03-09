// app/api/analytics/student/[id]/trends/route.ts
// ============================================================
// GET /api/analytics/student/:id/trends - Get student trends
// ============================================================

import { NextRequest } from "next/server";
import { z } from "zod";
import { withAuth } from "@/lib/api/withAuth";
import { validateQuery, validateUuid } from "@/lib/api/validation";
import {
  successResponse,
  notFoundResponse,
  validationErrorResponse,
  forbiddenResponse,
} from "@/lib/api/response";
import { calculateStudentTrends } from "@/features/assessments";
import { createSupabaseServerClient } from "@/lib/supabase/server";

// ============================================================
// Query Schema
// ============================================================
const querySchema = z.object({
  academicYearId: z.string().uuid(),
});

// ============================================================
// GET Handler
// ============================================================
export const GET = withAuth(async (request, { user, params }) => {
  const studentId = params?.id;
  if (!studentId) return notFoundResponse("Student ID required");

  const idValidation = validateUuid(studentId);
  if (!idValidation.success) {
    return validationErrorResponse(idValidation.errors!);
  }

  // Check access for parents/students
  if (user.role === "parent") {
    const supabase = await createSupabaseServerClient();
    const { data: guardianLinks } = await supabase
      .from("student_guardians")
      .select("student_id")
      .eq("guardian_user_id", user.id);

    const childIds = (guardianLinks as any)?.map((g: any) => g.student_id) || [];
    if (!childIds.includes(studentId)) {
      return forbiddenResponse("Access denied");
    }
  }

  if (user.role === "student") {
    const supabase = await createSupabaseServerClient();
    const { data: studentRecord } = await supabase
      .from("students")
      .select("student_id")
      .eq("user_id", user.id)
      .single();

    if ((studentRecord as any)?.student_id !== studentId) {
      return forbiddenResponse("Access denied");
    }
  }

  const { searchParams } = new URL(request.url);
  const queryValidation = validateQuery(searchParams, querySchema);
  if (!queryValidation.success) {
    return validationErrorResponse(queryValidation.errors!);
  }

  const { academicYearId } = queryValidation.data!;

  const trends = await calculateStudentTrends(studentId, academicYearId, user);

  return successResponse(trends);
});

