// features/finance/services/feeStructures.service.ts
// ============================================================
// Fee Structures CRUD service
// ============================================================

import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { AuthUser } from "@/types/auth";
import type { FeeStructure } from "../types";
import type {
  CreateFeeStructureInput,
  UpdateFeeStructureInput,
  FeeStructureFiltersInput,
} from "../validators/finance.schema";
import type { PaginatedResponse } from "@/features/users/types";

// ============================================================
// LIST FEE STRUCTURES
// ============================================================
export async function listFeeStructures(
  filters: FeeStructureFiltersInput,
  currentUser: AuthUser,
): Promise<PaginatedResponse<FeeStructure>> {
  const supabase = await createSupabaseServerClient();
  const { page, pageSize, search, academicYearId, termId, gradeId, isActive } =
    filters;
  const offset = (page - 1) * pageSize;

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

  // School scoping
  if (currentUser.role !== "super_admin") {
    query = query.eq("school_id", currentUser.schoolId!);
  }

  // Filters
  if (search) {
    query = query.ilike("name", `%${search}%`);
  }
  if (academicYearId) {
    query = query.eq("academic_year_id", academicYearId);
  }
  if (termId) {
    query = query.eq("term_id", termId);
  }
  if (gradeId) {
    query = query.eq("grade_id", gradeId);
  }
  if (isActive !== undefined) {
    query = query.eq("is_active", isActive);
  }

  query = query
    .order("name", { ascending: true })
    .range(offset, offset + pageSize - 1);

  const { data, error, count } = await query;

  if (error) {
    throw new Error(`Failed to list fee structures: ${error.message}`);
  }

  const items: FeeStructure[] = (data || []).map((row: any) => ({
    id: row.id,
    schoolId: row.school_id,
    name: row.name,
    description: row.description,
    amount: parseFloat(row.amount),
    academicYearId: row.academic_year_id,
    academicYear: row.academic_years?.year || null,
    termId: row.term_id,
    termName: row.terms?.name || null,
    gradeId: row.grade_id,
    gradeName: row.grades?.name || null,
    isMandatory: row.is_mandatory,
    isActive: row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    createdBy: row.created_by,
  }));

  const total = count || 0;

  return {
    data: items,
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  };
}

// ============================================================
// GET FEE STRUCTURE BY ID
// ============================================================
export async function getFeeStructureById(
  id: string,
  currentUser: AuthUser,
): Promise<FeeStructure | null> {
  const supabase = await createSupabaseServerClient();

  let query = supabase
    .from("fee_structures")
    .select(
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
    )
    .eq("id", id);

  if (currentUser.role !== "super_admin") {
    query = query.eq("school_id", currentUser.schoolId!);
  }

  const { data, error } = await query.single();

  if (error || !data) return null;

  return {
    id: data.id,
    schoolId: data.school_id,
    name: data.name,
    description: data.description,
    amount: parseFloat(data.amount),
    academicYearId: data.academic_year_id,
    academicYear: data.academic_years?.year || null,
    termId: data.term_id,
    termName: data.terms?.name || null,
    gradeId: data.grade_id,
    gradeName: data.grades?.name || null,
    isMandatory: data.is_mandatory,
    isActive: data.is_active,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
    createdBy: data.created_by,
  };
}

// ============================================================
// CREATE FEE STRUCTURE
// ============================================================
export async function createFeeStructure(
  payload: CreateFeeStructureInput,
  currentUser: AuthUser,
): Promise<{ success: boolean; message: string; id?: string }> {
  const supabase = await createSupabaseServerClient();
  const schoolId = currentUser.schoolId!;

  // Check for duplicate name in same academic year
  const { data: existing } = await supabase
    .from("fee_structures")
    .select("id")
    .eq("school_id", schoolId)
    .eq("academic_year_id", payload.academicYearId)
    .eq("name", payload.name)
    .maybeSingle();

  if (existing) {
    return {
      success: false,
      message:
        "A fee structure with this name already exists for this academic year.",
    };
  }

  const { data, error } = await supabase
    .from("fee_structures")
    .insert({
      school_id: schoolId,
      name: payload.name,
      description: payload.description || null,
      amount: payload.amount,
      academic_year_id: payload.academicYearId,
      term_id: payload.termId || null,
      grade_id: payload.gradeId || null,
      is_mandatory: payload.isMandatory ?? true,
      is_active: true,
      created_by: currentUser.id,
    })
    .select("id")
    .single();

  if (error) {
    return { success: false, message: `Creation failed: ${error.message}` };
  }

  return {
    success: true,
    message: "Fee structure created successfully.",
    id: data.id,
  };
}

// ============================================================
// UPDATE FEE STRUCTURE
// ============================================================
export async function updateFeeStructure(
  id: string,
  payload: UpdateFeeStructureInput,
  currentUser: AuthUser,
): Promise<{ success: boolean; message: string }> {
  const supabase = await createSupabaseServerClient();

  const updateData: Record<string, any> = {};

  if (payload.name !== undefined) updateData.name = payload.name;
  if (payload.description !== undefined)
    updateData.description = payload.description || null;
  if (payload.amount !== undefined) updateData.amount = payload.amount;
  if (payload.isMandatory !== undefined)
    updateData.is_mandatory = payload.isMandatory;
  if (payload.isActive !== undefined) updateData.is_active = payload.isActive;

  let query = supabase.from("fee_structures").update(updateData).eq("id", id);

  if (currentUser.role !== "super_admin") {
    query = query.eq("school_id", currentUser.schoolId!);
  }

  const { error } = await query;

  if (error) {
    return { success: false, message: `Update failed: ${error.message}` };
  }

  return { success: true, message: "Fee structure updated successfully." };
}

// ============================================================
// DELETE FEE STRUCTURE (soft delete)
// ============================================================
export async function deleteFeeStructure(
  id: string,
  currentUser: AuthUser,
): Promise<{ success: boolean; message: string }> {
  const supabase = await createSupabaseServerClient();

  // Check if any student fees are linked
  const { count } = await supabase
    .from("student_fees")
    .select("id", { count: "exact", head: true })
    .eq("fee_structure_id", id);

  if (count && count > 0) {
    return {
      success: false,
      message:
        "Cannot delete fee structure with existing student assignments. Deactivate instead.",
    };
  }

  let query = supabase.from("fee_structures").delete().eq("id", id);

  if (currentUser.role !== "super_admin") {
    query = query.eq("school_id", currentUser.schoolId!);
  }

  const { error } = await query;

  if (error) {
    return { success: false, message: `Deletion failed: ${error.message}` };
  }

  return { success: true, message: "Fee structure deleted successfully." };
}
