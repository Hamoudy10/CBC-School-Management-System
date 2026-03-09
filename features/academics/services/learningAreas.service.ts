// features/academics/services/learningAreas.service.ts
// ============================================================
// Learning Areas (CBC Subjects) CRUD service
// Server-side only — all queries go through RLS
// ============================================================

import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { AuthUser } from "@/types/auth";
import type { LearningArea } from "../types";
import type {
  CreateLearningAreaInput,
  UpdateLearningAreaInput,
  LearningAreaFiltersInput,
} from "../validators/academic.schema";
import type { PaginatedResponse } from "@/features/users/types";

// ============================================================
// LIST LEARNING AREAS
// ============================================================
export async function listLearningAreas(
  filters: LearningAreaFiltersInput,
  currentUser: AuthUser,
): Promise<PaginatedResponse<LearningArea>> {
  const supabase = await createSupabaseServerClient();
  const learningAreasTable = () => supabase.from("learning_areas") as any;
  const { page, pageSize, search, isCore } = filters;
  const offset = (page - 1) * pageSize;

  let query = learningAreasTable().select("*", { count: "exact" });

  // School scoping
  if (currentUser.role !== "super_admin") {
    query = query.eq("school_id", currentUser.schoolId!);
  }

  // Filters
  if (search) {
    query = query.ilike("name", `%${search}%`);
  }
  if (isCore !== undefined) {
    query = query.eq("is_core", isCore);
  }

  query = query
    .order("name", { ascending: true })
    .range(offset, offset + pageSize - 1);

  const { data, error, count } = await query;

  if (error) {
    throw new Error(`Failed to list learning areas: ${error.message}`);
  }

  const items: LearningArea[] = (data || []).map((row: any) => ({
    learningAreaId: row.learning_area_id,
    schoolId: row.school_id,
    name: row.name,
    description: row.description,
    isCore: row.is_core,
    applicableGrades: row.applicable_grades || [],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
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
// GET SINGLE LEARNING AREA
// ============================================================
export async function getLearningAreaById(
  id: string,
  currentUser: AuthUser,
): Promise<LearningArea | null> {
  const supabase = await createSupabaseServerClient();
  const learningAreasTable = () => supabase.from("learning_areas") as any;

  let query = learningAreasTable().select("*").eq("learning_area_id", id);

  if (currentUser.role !== "super_admin") {
    query = query.eq("school_id", currentUser.schoolId!);
  }

  const { data, error } = await query.single();

  if (error || !data) return null;

  const row = data as any;
  return {
    learningAreaId: row.learning_area_id,
    schoolId: row.school_id,
    name: row.name,
    description: row.description,
    isCore: row.is_core,
    applicableGrades: row.applicable_grades || [],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// ============================================================
// CREATE LEARNING AREA
// ============================================================
export async function createLearningArea(
  payload: CreateLearningAreaInput,
  currentUser: AuthUser,
): Promise<{ success: boolean; message: string; id?: string }> {
  const supabase = await createSupabaseServerClient();
  const learningAreasTable = () => supabase.from("learning_areas") as any;
  const schoolId = currentUser.schoolId;

  if (!schoolId && currentUser.role !== "super_admin") {
    return { success: false, message: "School context required." };
  }

  // Check duplicate name within school
  const { data: existing } = await learningAreasTable()
    .select("learning_area_id")
    .eq("school_id", schoolId!)
    .eq("name", payload.name)
    .maybeSingle();

  if (existing) {
    return {
      success: false,
      message: "A learning area with this name already exists.",
    };
  }

  const { data, error } = await learningAreasTable()
    .insert({
      school_id: schoolId!,
      name: payload.name,
      description: payload.description || null,
      is_core: payload.isCore ?? true,
      applicable_grades: payload.applicableGrades || [],
    })
    .select("learning_area_id")
    .single();

  if (error) {
    return { success: false, message: `Creation failed: ${error.message}` };
  }

  return {
    success: true,
    message: "Learning area created successfully.",
    id: (data as any).learning_area_id,
  };
}

// ============================================================
// UPDATE LEARNING AREA
// ============================================================
export async function updateLearningArea(
  id: string,
  payload: UpdateLearningAreaInput,
  currentUser: AuthUser,
): Promise<{ success: boolean; message: string }> {
  const supabase = await createSupabaseServerClient();
  const learningAreasTable = () => supabase.from("learning_areas") as any;

  const updateData: Record<string, any> = {};

  if (payload.name !== undefined) updateData.name = payload.name;
  if (payload.description !== undefined)
    updateData.description = payload.description || null;
  if (payload.isCore !== undefined) updateData.is_core = payload.isCore;
  if (payload.applicableGrades !== undefined)
    updateData.applicable_grades = payload.applicableGrades;

  let query = learningAreasTable().update(updateData).eq("learning_area_id", id);

  if (currentUser.role !== "super_admin") {
    query = query.eq("school_id", currentUser.schoolId!);
  }

  const { error } = await query;

  if (error) {
    return { success: false, message: `Update failed: ${error.message}` };
  }

  return { success: true, message: "Learning area updated successfully." };
}

// ============================================================
// DELETE LEARNING AREA (only if no strands exist)
// ============================================================
export async function deleteLearningArea(
  id: string,
  currentUser: AuthUser,
): Promise<{ success: boolean; message: string }> {
  const supabase = await createSupabaseServerClient();
  const learningAreasTable = () => supabase.from("learning_areas") as any;
  const strandsTable = () => supabase.from("strands") as any;

  // Check for child strands
  const { count } = await strandsTable()
    .select("strand_id", { count: "exact", head: true })
    .eq("learning_area_id", id);

  if (count && count > 0) {
    return {
      success: false,
      message:
        "Cannot delete learning area with existing strands. Remove strands first.",
    };
  }

  let query = learningAreasTable().delete().eq("learning_area_id", id);

  if (currentUser.role !== "super_admin") {
    query = query.eq("school_id", currentUser.schoolId!);
  }

  const { error } = await query;

  if (error) {
    return { success: false, message: `Deletion failed: ${error.message}` };
  }

  return { success: true, message: "Learning area deleted successfully." };
}
