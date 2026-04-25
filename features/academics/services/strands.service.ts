// features/academics/services/strands.service.ts
// ============================================================
// Strands CRUD service
// Strands sit under Learning Areas in the CBC hierarchy
// ============================================================

import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { AuthUser } from "@/types/auth";
import type { Strand } from "../types";
import type {
  CreateStrandInput,
  UpdateStrandInput,
} from "../validators/academic.schema";

// ============================================================
// LIST STRANDS (by learning area)
// ============================================================
export async function listStrands(
  learningAreaId: string,
  currentUser: AuthUser,
): Promise<Strand[]> {
  const supabase = await createSupabaseServerClient();
  const strandsTable = () => supabase.from("strands") as any;

  let query = strandsTable()
    .select(
      `
      *,
      learning_areas (
        name
      )
    `
    )
    .eq("learning_area_id", learningAreaId);

  if (currentUser.role !== "super_admin") {
    query = query.eq("school_id", currentUser.schoolId!);
  }

  query = query.order("sort_order", { ascending: true });

  const { data, error } = await query;

  if (error) {
    throw new Error(`Failed to list strands: ${error.message}`);
  }

  return (data || []).map((row: any) => ({
    strandId: row.id,
    schoolId: row.school_id,
    learningAreaId: row.learning_area_id,
    learningAreaName: row.learning_areas?.name || null,
    name: row.name,
    description: row.description,
    sortOrder: row.sort_order,
    createdAt: row.created_at,
  }));
}

// ============================================================
// GET SINGLE STRAND
// ============================================================
export async function getStrandById(
  strandId: string,
  currentUser: AuthUser,
): Promise<Strand | null> {
  const supabase = await createSupabaseServerClient();
  const strandsTable = () => supabase.from("strands") as any;

  let query = strandsTable()
    .select(
      `
      *,
      learning_areas (
        name
      )
    `
    )
    .eq("strand_id", strandId);

  if (currentUser.role !== "super_admin") {
    query = query.eq("school_id", currentUser.schoolId!);
  }

  const { data, error } = await query.single();

  if (error || !data) return null;

  const row = data as any;
  return {
    strandId: row.id,
    schoolId: row.school_id,
    learningAreaId: row.learning_area_id,
    learningAreaName: row.learning_areas?.name || null,
    name: row.name,
    description: row.description,
    sortOrder: row.sort_order,
    createdAt: row.created_at,
  };
}

// ============================================================
// CREATE STRAND
// ============================================================
export async function createStrand(
  payload: CreateStrandInput,
  currentUser: AuthUser,
): Promise<{ success: boolean; message: string; id?: string }> {
  const supabase = await createSupabaseServerClient();
  const strandsTable = () => supabase.from("strands") as any;
  const learningAreasTable = () => supabase.from("learning_areas") as any;
  const schoolId = currentUser.schoolId!;

  // Verify learning area exists and belongs to school
  const { data: la } = await learningAreasTable()
    .select("learning_area_id")
    .eq("learning_area_id", payload.learningAreaId)
    .eq("school_id", schoolId)
    .maybeSingle();

  if (!la) {
    return {
      success: false,
      message: "Learning area not found in your school.",
    };
  }

  // Check duplicate
  const { data: existing } = await strandsTable()
    .select("strand_id")
    .eq("learning_area_id", payload.learningAreaId)
    .eq("name", payload.name)
    .maybeSingle();

  if (existing) {
    return {
      success: false,
      message:
        "A strand with this name already exists under this learning area.",
    };
  }

  const { data, error } = await strandsTable()
    .insert({
      school_id: schoolId,
      learning_area_id: payload.learningAreaId,
      name: payload.name,
      description: payload.description || null,
      sort_order: payload.sortOrder ?? 0,
    })
    .select("strand_id")
    .single();

  if (error) {
    return { success: false, message: `Creation failed: ${error.message}` };
  }

  return {
    success: true,
    message: "Strand created successfully.",
    id: (data as any).strand_id,
  };
}

// ============================================================
// UPDATE STRAND
// ============================================================
export async function updateStrand(
  strandId: string,
  payload: UpdateStrandInput,
  currentUser: AuthUser,
): Promise<{ success: boolean; message: string }> {
  const supabase = await createSupabaseServerClient();
  const strandsTable = () => supabase.from("strands") as any;

  const updateData: Record<string, any> = {};
  if (payload.name !== undefined) updateData.name = payload.name;
  if (payload.description !== undefined)
    updateData.description = payload.description || null;
  if (payload.sortOrder !== undefined)
    updateData.sort_order = payload.sortOrder;

  let query = strandsTable().update(updateData).eq("strand_id", strandId);

  if (currentUser.role !== "super_admin") {
    query = query.eq("school_id", currentUser.schoolId!);
  }

  const { error } = await query;

  if (error) {
    return { success: false, message: `Update failed: ${error.message}` };
  }

  return { success: true, message: "Strand updated successfully." };
}

// ============================================================
// DELETE STRAND (only if no sub-strands exist)
// ============================================================
export async function deleteStrand(
  strandId: string,
  currentUser: AuthUser,
): Promise<{ success: boolean; message: string }> {
  const supabase = await createSupabaseServerClient();
  const strandsTable = () => supabase.from("strands") as any;
  const subStrandsTable = () => supabase.from("sub_strands") as any;

  const { count } = await subStrandsTable()
    .select("sub_strand_id", { count: "exact", head: true })
    .eq("strand_id", strandId);

  if (count && count > 0) {
    return {
      success: false,
      message:
        "Cannot delete strand with existing sub-strands. Remove sub-strands first.",
    };
  }

  let query = strandsTable().delete().eq("strand_id", strandId);

  if (currentUser.role !== "super_admin") {
    query = query.eq("school_id", currentUser.schoolId!);
  }

  const { error } = await query;

  if (error) {
    return { success: false, message: `Deletion failed: ${error.message}` };
  }

  return { success: true, message: "Strand deleted successfully." };
}
