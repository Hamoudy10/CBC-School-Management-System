// app/api/student-fees/route.ts
// ============================================================
// GET /api/student-fees - List student fees
// POST /api/student-fees - Assign fee to student
// ============================================================

import { NextRequest } from "next/server";
import { z } from "zod";
import { withPermission, withAuth } from "@/lib/api/withAuth";
import { validateBody, validateQuery } from "@/lib/api/validation";
import {
  successResponse,
  createdResponse,
  errorResponse,
  validationErrorResponse,
  forbiddenResponse,
} from "@/lib/api/response";
import { createSupabaseServerClient } from "@/lib/supabase/server";

// ============================================================
// Filter Schema
// ============================================================
const studentFeeFiltersSchema = z.object({
  studentId: z.string().uuid().optional(),
  academicYearId: z.string().uuid().optional(),
  termId: z.string().uuid().optional(),
  status: z
    .enum(["pending", "partial", "paid", "overdue", "waived"])
    .optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(50),
});

// ============================================================
// Create Schema
// ============================================================
const createStudentFeeSchema = z.object({
  studentId: z.string().uuid(),
  feeStructureId: z.string().uuid(),
  amountDue: z.coerce.number().min(0).optional(),
  dueDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  academicYearId: z.string().uuid(),
  termId: z.string().uuid().optional(),
});

// ============================================================
// GET Handler
// ============================================================
export const GET = withAuth(async (request, { user }) => {
  const { searchParams } = new URL(request.url);

  const validation = validateQuery(searchParams, studentFeeFiltersSchema);
  if (!validation.success) {
    return validationErrorResponse(validation.errors!);
  }

  const filters = validation.data!;
  const { page, pageSize } = filters;
  const offset = (page - 1) * pageSize;

  const supabase = await createSupabaseServerClient();

  let query = supabase.from("student_fees").select(
    `
      *,
      students (
        first_name,
        last_name,
        admission_number
      ),
      fee_structures (
        name,
        amount
      )
    `,
    { count: "exact" },
  );

  if (user.role !== "super_admin") {
    query = query.eq("school_id", user.schoolId!);
  }

  // Parents see only their children's fees
  if (user.role === "parent") {
    const { data: guardianLinks } = await supabase
      .from("student_guardians")
      .select("student_id")
      .eq("guardian_user_id", user.id);

    const childIds = (guardianLinks as any)?.map((g: any) => g.student_id) || [];
    if (childIds.length === 0) {
      return successResponse([], { page, pageSize, total: 0, totalPages: 0 });
    }
    query = query.in("student_id", childIds);
  }

  // Students see only their own fees
  if (user.role === "student") {
    const { data: studentRecord } = await supabase
      .from("students")
      .select("student_id")
      .eq("user_id", user.id)
      .single();

    if (!studentRecord) {
      return successResponse([], { page, pageSize, total: 0, totalPages: 0 });
    }
    query = query.eq("student_id", (studentRecord as any).student_id);
  }

  // Filters
  if (filters.studentId) {
    query = query.eq("student_id", filters.studentId);
  }
  if (filters.academicYearId) {
    query = query.eq("academic_year_id", filters.academicYearId);
  }
  if (filters.termId) {
    query = query.eq("term_id", filters.termId);
  }
  if (filters.status) {
    query = query.eq("status", filters.status);
  }

  query = query
    .order("created_at", { ascending: false })
    .range(offset, offset + pageSize - 1);

  const { data, error, count } = await query;

  if (error) {
    return errorResponse(`Failed to fetch student fees: ${error.message}`);
  }

  return successResponse(data, {
    page,
    pageSize,
    total: count || 0,
    totalPages: Math.ceil((count || 0) / pageSize),
  });
});

// ============================================================
// POST Handler
// ============================================================
export const POST = withPermission(
  "finance",
  "create",
  async (request, { user }) => {
    const validation = await validateBody(request, createStudentFeeSchema);
    if (!validation.success) {
      return validationErrorResponse(validation.errors!);
    }

    const data = validation.data!;
    const supabase = await createSupabaseServerClient();

    // Get fee structure amount if not provided
    let amountDue = data.amountDue;
    if (amountDue === undefined) {
      const { data: feeStructure } = await supabase
        .from("fee_structures")
        .select("amount")
        .eq("id", data.feeStructureId)
        .single();

      amountDue = (feeStructure as any)?.amount || 0;
    }

    const { data: studentFee, error } = await (supabase
      .from("student_fees") as any)
      .insert({
        school_id: user.schoolId!,
        student_id: data.studentId,
        fee_structure_id: data.feeStructureId,
        amount_due: amountDue,
        due_date: data.dueDate || null,
        academic_year_id: data.academicYearId,
        term_id: data.termId || null,
        status: "pending",
        created_by: user.id,
      })
      .select("id")
      .single();

    if (error) {
      return errorResponse(`Failed to assign fee: ${error.message}`);
    }

    return createdResponse({
      studentFeeId: (studentFee as any).id,
      message: "Fee assigned successfully",
    });
  },
);
