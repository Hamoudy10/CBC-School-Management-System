// app/api/fees/route.ts
// ============================================================
// GET /api/fees - List fee structures
// POST /api/fees - Create fee structure
// ============================================================

import { NextRequest } from "next/server";
import { z } from "zod";
import { withPermission } from "@/lib/api/withAuth";
import { validateBody, validateQuery } from "@/lib/api/validation";
import {
  successResponse,
  createdResponse,
  errorResponse,
  validationErrorResponse,
} from "@/lib/api/response";
import { createSupabaseServerClient } from "@/lib/supabase/server";

// ============================================================
// Filter Schema
// ============================================================
const feeFiltersSchema = z.object({
  academicYearId: z.string().uuid().optional(),
  termId: z.string().uuid().optional(),
  gradeId: z.string().uuid().optional(),
  isActive: z
    .string()
    .transform((v) => v === "true")
    .optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(50),
});

// ============================================================
// Create Schema
// ============================================================
const createFeeSchema = z.object({
  name: z.string().min(1).max(150),
  description: z.string().optional(),
  amount: z.coerce.number().min(0),
  academicYearId: z.string().uuid(),
  termId: z.string().uuid().optional(),
  gradeId: z.string().uuid().optional(),
  isMandatory: z.boolean().default(true),
});

// ============================================================
// GET Handler
// ============================================================
export const GET = withPermission(
  "finance",
  "view",
  async (request, { user }) => {
    const { searchParams } = new URL(request.url);

    const validation = validateQuery(searchParams, feeFiltersSchema);
    if (!validation.success) {
      return validationErrorResponse(validation.errors!);
    }

    const filters = validation.data!;
    const { page, pageSize } = filters;
    const offset = (page - 1) * pageSize;

    const supabase = await createSupabaseServerClient();

    let query = supabase.from("fee_structures").select(
      `
      *,
      academic_years (
        year
      ),
      terms (
        name
      ),
      grades (
        name
      )
    `,
      { count: "exact" },
    );

    if (user.role !== "super_admin") {
      query = query.eq("school_id", user.schoolId!);
    }

    if (filters.academicYearId) {
      query = query.eq("academic_year_id", filters.academicYearId);
    }
    if (filters.termId) {
      query = query.eq("term_id", filters.termId);
    }
    if (filters.gradeId) {
      query = query.eq("grade_id", filters.gradeId);
    }
    if (filters.isActive !== undefined) {
      query = query.eq("is_active", filters.isActive);
    }

    query = query
      .order("name", { ascending: true })
      .range(offset, offset + pageSize - 1);

    const { data, error, count } = await query;

    if (error) {
      return errorResponse(`Failed to fetch fees: ${error.message}`);
    }

    return successResponse(data, {
      page,
      pageSize,
      total: count || 0,
      totalPages: Math.ceil((count || 0) / pageSize),
    });
  },
);

// ============================================================
// POST Handler
// ============================================================
export const POST = withPermission(
  "finance",
  "create",
  async (request, { user }) => {
    const validation = await validateBody(request, createFeeSchema);
    if (!validation.success) {
      return validationErrorResponse(validation.errors!);
    }

    const data = validation.data!;
    const supabase = await createSupabaseServerClient();

    const { data: fee, error } = await (supabase
      .from("fee_structures") as any)
      .insert({
        school_id: user.schoolId!,
        name: data.name,
        description: data.description || null,
        amount: data.amount,
        academic_year_id: data.academicYearId,
        term_id: data.termId || null,
        grade_id: data.gradeId || null,
        is_mandatory: data.isMandatory,
        is_active: true,
        created_by: user.id,
      })
      .select("id")
      .single();

    if (error) {
      return errorResponse(`Failed to create fee: ${error.message}`);
    }

    return createdResponse({
      feeId: (fee as any).id,
      message: "Fee structure created successfully",
    });
  },
);
