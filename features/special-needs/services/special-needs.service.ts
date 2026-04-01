// features/special-needs/services/special-needs.service.ts
// ============================================================
// Special Needs CRUD service
// ============================================================

import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { AuthUser } from "@/types/auth";
import type {
  SpecialNeed,
  SpecialNeedFilters,
  PaginatedResponse,
} from "../types";
import type {
  CreateSpecialNeedInput,
  UpdateSpecialNeedInput,
} from "../validators/special-needs.schema";
import { NEEDS_TYPE_LABELS as LABELS } from "../types";

function normalizeRow(row: any): SpecialNeed {
  const student = Array.isArray(row.students) ? row.students[0] : row.students;
  const classData = Array.isArray(row.classes) ? row.classes[0] : row.classes;
  const creator = Array.isArray(row.creator) ? row.creator[0] : row.creator;

  return {
    specialNeedsId: row.special_needs_id,
    schoolId: row.school_id,
    studentId: row.student_id,
    studentName: student
      ? `${student.first_name ?? ""} ${student.last_name ?? ""}`.trim()
      : undefined,
    studentAdmissionNo: student?.admission_number,
    className: classData?.name,
    needsType: row.needs_type,
    needsTypeLabel: (LABELS as Record<string, string>)[row.needs_type] ?? row.needs_type,
    description: row.description ?? null,
    accommodations: row.accommodations ?? null,
    assessmentAdjustments: row.assessment_adjustments ?? null,
    isActive: row.is_active,
    createdBy: row.created_by,
    createdByName: creator
      ? `${creator.first_name ?? ""} ${creator.last_name ?? ""}`.trim()
      : undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function listSpecialNeeds(
  filters: SpecialNeedFilters,
  currentUser: AuthUser,
): Promise<PaginatedResponse<SpecialNeed>> {
  if (!currentUser.schoolId) {
    throw new Error("School context is required.");
  }

  const supabase = await createSupabaseServerClient();
  const page = filters.page ?? 1;
  const pageSize = filters.pageSize ?? 50;
  const offset = (page - 1) * pageSize;

  let query = supabase
    .from("special_needs")
    .select(
      `
      special_needs_id,
      school_id,
      student_id,
      needs_type,
      description,
      accommodations,
      assessment_adjustments,
      is_active,
      created_by,
      created_at,
      updated_at,
      students(first_name, last_name, admission_number, current_class_id),
      classes(name),
      creator:users!special_needs_created_by_fkey(first_name, last_name)
    `,
      { count: "exact" },
    )
    .eq("school_id", currentUser.schoolId);

  if (filters.studentId) {
    query = query.eq("student_id", filters.studentId);
  }
  if (filters.needsType) {
    query = query.eq("needs_type", filters.needsType);
  }
  if (filters.isActive !== undefined) {
    query = query.eq("is_active", filters.isActive);
  }

  const { data, error, count } = await query
    .order("created_at", { ascending: false })
    .range(offset, offset + pageSize - 1);

  if (error) {
    throw new Error(`Failed to list special needs: ${error.message}`);
  }

  return {
    data: (data ?? []).map(normalizeRow),
    total: count ?? 0,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil((count ?? 0) / pageSize)),
  };
}

export async function getSpecialNeedById(
  id: string,
  currentUser: AuthUser,
): Promise<SpecialNeed | null> {
  if (!currentUser.schoolId) {
    throw new Error("School context is required.");
  }

  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("special_needs")
    .select(
      `
      special_needs_id,
      school_id,
      student_id,
      needs_type,
      description,
      accommodations,
      assessment_adjustments,
      is_active,
      created_by,
      created_at,
      updated_at,
      students(first_name, last_name, admission_number, current_class_id, classes(name)),
      creator:users!special_needs_created_by_fkey(first_name, last_name)
    `,
    )
    .eq("special_needs_id", id)
    .eq("school_id", currentUser.schoolId)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  return normalizeRow(data);
}

export async function createSpecialNeed(
  payload: CreateSpecialNeedInput,
  currentUser: AuthUser,
): Promise<{ success: boolean; message: string; specialNeedsId?: string }> {
  if (!currentUser.schoolId) {
    return { success: false, message: "School context is required." };
  }

  const supabase = await createSupabaseServerClient();

  // Verify student exists and belongs to school
  const { data: student } = await supabase
    .from("students")
    .select("student_id")
    .eq("student_id", payload.studentId)
    .eq("school_id", currentUser.schoolId)
    .maybeSingle();

  if (!student) {
    return { success: false, message: "Student not found for this school." };
  }

  const { data, error } = await supabase
    .from("special_needs")
    .insert({
      school_id: currentUser.schoolId,
      student_id: payload.studentId,
      needs_type: payload.needsType,
      description: payload.description ?? null,
      accommodations: payload.accommodations ?? null,
      assessment_adjustments: payload.assessmentAdjustments ?? null,
      is_active: true,
      created_by: currentUser.id,
    })
    .select("special_needs_id")
    .single();

  if (error) {
    return { success: false, message: `Failed to create record: ${error.message}` };
  }

  return {
    success: true,
    message: "Special needs record created successfully.",
    specialNeedsId: data.special_needs_id,
  };
}

export async function updateSpecialNeed(
  id: string,
  payload: UpdateSpecialNeedInput,
  currentUser: AuthUser,
): Promise<{ success: boolean; message: string }> {
  if (!currentUser.schoolId) {
    return { success: false, message: "School context is required." };
  }

  const supabase = await createSupabaseServerClient();

  const { data: existing } = await supabase
    .from("special_needs")
    .select("special_needs_id")
    .eq("special_needs_id", id)
    .eq("school_id", currentUser.schoolId)
    .maybeSingle();

  if (!existing) {
    return { success: false, message: "Special needs record not found." };
  }

  const updateData: Record<string, unknown> = {};
  if (payload.needsType !== undefined) updateData.needs_type = payload.needsType;
  if (payload.description !== undefined) updateData.description = payload.description ?? null;
  if (payload.accommodations !== undefined) updateData.accommodations = payload.accommodations ?? null;
  if (payload.assessmentAdjustments !== undefined) updateData.assessment_adjustments = payload.assessmentAdjustments;
  if (payload.isActive !== undefined) updateData.is_active = payload.isActive;

  const { error } = await supabase
    .from("special_needs")
    .update(updateData)
    .eq("special_needs_id", id)
    .eq("school_id", currentUser.schoolId);

  if (error) {
    return { success: false, message: `Failed to update record: ${error.message}` };
  }

  return { success: true, message: "Special needs record updated successfully." };
}

export async function deleteSpecialNeed(
  id: string,
  currentUser: AuthUser,
): Promise<{ success: boolean; message: string }> {
  if (!currentUser.schoolId) {
    return { success: false, message: "School context is required." };
  }

  const supabase = await createSupabaseServerClient();

  const { data: existing } = await supabase
    .from("special_needs")
    .select("special_needs_id")
    .eq("special_needs_id", id)
    .eq("school_id", currentUser.schoolId)
    .maybeSingle();

  if (!existing) {
    return { success: false, message: "Special needs record not found." };
  }

  // Soft delete by setting is_active to false
  const { error } = await supabase
    .from("special_needs")
    .update({ is_active: false })
    .eq("special_needs_id", id)
    .eq("school_id", currentUser.schoolId);

  if (error) {
    return { success: false, message: `Failed to delete record: ${error.message}` };
  }

  return { success: true, message: "Special needs record deactivated successfully." };
}
