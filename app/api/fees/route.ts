import { NextRequest } from "next/server";
import { z } from "zod";
import { withPermission } from "@/lib/api/withAuth";
import {
  createdResponse,
  errorResponse,
  successResponse,
  validationErrorResponse,
} from "@/lib/api/response";
import { validateBody, validateQuery } from "@/lib/api/validation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getActiveAcademicYear } from "@/features/settings/services/academicYear.service";

const feeFiltersSchema = z.object({
  academicYearId: z.string().uuid().optional(),
  termId: z.string().uuid().optional(),
  gradeId: z.string().uuid().optional(),
  isActive: z
    .string()
    .transform((value) => value === "true")
    .optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(50),
  page_size: z.coerce.number().int().min(1).max(100).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
});

const createFeeSchema = z.object({
  name: z.string().min(1).max(150),
  description: z.string().max(1000).nullish(),
  amount: z.coerce.number().min(0),
  academicYearId: z.string().uuid().optional(),
  termId: z.string().uuid().nullish(),
  gradeId: z.string().uuid().nullish(),
  isMandatory: z.boolean().default(true),
  isActive: z.boolean().optional(),
});

type FeeRow = {
  id: string;
  school_id: string;
  name: string;
  description: string | null;
  amount: number | string;
  academic_year_id: string;
  term_id: string | null;
  grade_id: string | null;
  is_mandatory: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  academic_years?: { year?: string | null } | null;
  terms?: { name?: string | null } | null;
  grades?: { name?: string | null } | null;
};

function normalizeFeeStructure(
  fee: FeeRow,
  statsMap: Map<string, { assignedCount: number; totalExpected: number; totalCollected: number }>,
) {
  const stats = statsMap.get(fee.id) ?? {
    assignedCount: 0,
    totalExpected: 0,
    totalCollected: 0,
  };
  const collectionRate =
    stats.totalExpected > 0 ? (stats.totalCollected / stats.totalExpected) * 100 : 0;

  return {
    id: fee.id,
    school_id: fee.school_id,
    schoolId: fee.school_id,
    name: fee.name,
    description: fee.description,
    amount: Number(fee.amount || 0),
    academic_year_id: fee.academic_year_id,
    academicYearId: fee.academic_year_id,
    academic_year: fee.academic_years ? { year: fee.academic_years.year ?? "" } : null,
    academicYear: fee.academic_years?.year ?? "",
    term_id: fee.term_id,
    termId: fee.term_id,
    term: fee.terms ? { name: fee.terms.name ?? "" } : null,
    termName: fee.terms?.name ?? null,
    grade_id: fee.grade_id,
    gradeId: fee.grade_id,
    grade: fee.grades ? { name: fee.grades.name ?? "" } : null,
    gradeName: fee.grades?.name ?? null,
    is_mandatory: fee.is_mandatory,
    isMandatory: fee.is_mandatory,
    is_active: fee.is_active,
    isActive: fee.is_active,
    created_at: fee.created_at,
    createdAt: fee.created_at,
    updated_at: fee.updated_at,
    updatedAt: fee.updated_at,
    assigned_count: stats.assignedCount,
    assignedCount: stats.assignedCount,
    total_expected: stats.totalExpected,
    totalExpected: stats.totalExpected,
    total_collected: stats.totalCollected,
    totalCollected: stats.totalCollected,
    collection_rate: collectionRate,
    collectionRate,
  };
}

export const GET = withPermission("finance", "view", async (request, { user }) => {
  const { searchParams } = new URL(request.url);
  const validation = validateQuery(searchParams, feeFiltersSchema);

  if (!validation.success) {
    return validationErrorResponse(validation.errors!);
  }

  const filters = validation.data!;
  const resolvedPageSize = filters.limit ?? filters.page_size ?? filters.pageSize;
  const offset = (filters.page - 1) * resolvedPageSize;
  const supabase = await createSupabaseServerClient();

  let query = supabase
    .from("fee_structures")
    .select(
      `
      id,
      school_id,
      name,
      description,
      amount,
      academic_year_id,
      term_id,
      grade_id,
      is_mandatory,
      is_active,
      created_at,
      updated_at,
      academic_years(year),
      terms(name),
      grades(name)
    `,
      { count: "exact" },
    )
    .eq("school_id", user.schoolId!);

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

  const { data, error, count } = await query
    .order("name", { ascending: true })
    .range(offset, offset + resolvedPageSize - 1);

  if (error) {
    return errorResponse(`Failed to fetch fees: ${error.message}`);
  }

  const feeIds = (data ?? []).map((fee: any) => fee.id);
  const statsMap = new Map<
    string,
    { assignedCount: number; totalExpected: number; totalCollected: number }
  >();

  if (feeIds.length > 0) {
    const { data: assignments, error: assignmentError } = await supabase
      .from("student_fees")
      .select("fee_structure_id, amount_due, amount_paid")
      .in("fee_structure_id", feeIds)
      .eq("school_id", user.schoolId!);

    if (assignmentError) {
      return errorResponse(`Failed to aggregate fee statistics: ${assignmentError.message}`);
    }

    for (const assignment of assignments ?? []) {
      const feeId = (assignment as any).fee_structure_id as string;
      const current = statsMap.get(feeId) ?? {
        assignedCount: 0,
        totalExpected: 0,
        totalCollected: 0,
      };

      current.assignedCount += 1;
      current.totalExpected += Number((assignment as any).amount_due || 0);
      current.totalCollected += Number((assignment as any).amount_paid || 0);
      statsMap.set(feeId, current);
    }
  }

  return successResponse(
    ((data ?? []) as FeeRow[]).map((fee) => normalizeFeeStructure(fee, statsMap)),
    {
      page: filters.page,
      pageSize: resolvedPageSize,
      total: count || 0,
      totalPages: Math.ceil((count || 0) / resolvedPageSize),
    },
  );
});

export const POST = withPermission("finance", "create", async (request, { user }) => {
  const validation = await validateBody(request, createFeeSchema);

  if (!validation.success) {
    return validationErrorResponse(validation.errors!);
  }

  const payload = validation.data!;
  const supabase = await createSupabaseServerClient();
  let academicYearId = payload.academicYearId ?? null;

  if (!academicYearId && payload.termId) {
    const { data: selectedTerm, error: termLookupError } = await supabase
      .from("terms")
      .select("academic_year_id")
      .eq("term_id", payload.termId)
      .eq("school_id", user.schoolId!)
      .maybeSingle();

    if (termLookupError) {
      return errorResponse(`Failed to validate selected term: ${termLookupError.message}`);
    }

    academicYearId = (selectedTerm as any)?.academic_year_id ?? null;
  }

  if (!academicYearId) {
    const activeYear = await getActiveAcademicYear(user.schoolId!);
    academicYearId = activeYear.success
      ? (activeYear.data as any)?.academic_year_id ?? activeYear.data?.id ?? null
      : null;
  }

  if (!academicYearId) {
    return errorResponse("No active academic year found. Create or activate one first.", 400);
  }

  const { data: fee, error } = await supabase
    .from("fee_structures")
    .insert({
      school_id: user.schoolId!,
      name: payload.name,
      description: payload.description || null,
      amount: payload.amount,
      academic_year_id: academicYearId,
      term_id: payload.termId || null,
      grade_id: payload.gradeId || null,
      is_mandatory: payload.isMandatory,
      is_active: payload.isActive ?? true,
      created_by: user.id,
    } as any)
    .select("id")
    .single();

  if (error) {
    return errorResponse(`Failed to create fee: ${error.message}`);
  }

  return createdResponse({
    feeId: (fee as any).id,
    message: "Fee structure created successfully",
  });
});
