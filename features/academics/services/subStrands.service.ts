// features/academics/services/subStrands.service.ts
// ============================================================
// Sub-Strands CRUD service
// Sub-strands sit under Strands in the CBC hierarchy
// ============================================================

import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { AuthUser } from "@/types/auth";
import type { SubStrand } from "../types";
import type {
  CreateSubStrandInput,
  UpdateSubStrandInput,
} from "../validators/academic.schema";

// ============================================================
// LIST SUB-STRANDS (by strand)
// ============================================================
export async function listSubStrands(
  strandId: string,
  currentUser: AuthUser,
): Promise<SubStrand[]> {
  const supabase = await createSupabaseServerClient();
  const subStrandsTable = () => supabase.from("sub_strands") as any;

  let query = subStrandsTable()
    .select(
      `
      *,
      strands (
        name
      )
    `,
    )
    .eq("strand_id", strandId);

  if (currentUser.role !== "super_admin") {
    query = query.eq("school_id", currentUser.schoolId!);
  }

  query = query.order("sort_order", { ascending: true });

  const { data, error } = await query;

  if (error) {
    throw new Error(`Failed to list sub-strands: ${error.message}`);
  }

  return (data || []).map((row: any) => ({
    subStrandId: row.sub_strand_id,
    schoolId: row.school_id,
    strandId: row.strand_id,
    strandName: row.strands?.name || null,
    name: row.name,
    description: row.description,
    sortOrder: row.sort_order,
    createdAt: row.created_at,
  }));
}

// ============================================================
// GET SINGLE SUB-STRAND
// ============================================================
export async function getSubStrandById(
  subStrandId: string,
  currentUser: AuthUser,
): Promise<SubStrand | null> {
  const supabase = await createSupabaseServerClient();
  const subStrandsTable = () => supabase.from("sub_strands") as any;

  let query = subStrandsTable()
    .select(
      `
      *,
      strands (
        name
      )
    `,
    )
    .eq("sub_strand_id", subStrandId);

  if (currentUser.role !== "super_admin") {
    query = query.eq("school_id", currentUser.schoolId!);
  }

  const { data, error } = await query.single();

  if (error || !data) return null;

  const row = data as any;
  return {
    subStrandId: row.sub_strand_id,
    schoolId: row.school_id,
    strandId: row.strand_id,
    strandName: row.strands?.name || null,
    name: row.name,
    description: row.description,
    sortOrder: row.sort_order,
    createdAt: row.created_at,
  };
}

// ============================================================
// CREATE SUB-STRAND
// ============================================================
export async function createSubStrand(
  payload: CreateSubStrandInput,
  currentUser: AuthUser,
): Promise<{ success: boolean; message: string; id?: string }> {
  const supabase = await createSupabaseServerClient();
  const subStrandsTable = () => supabase.from("sub_strands") as any;
  const strandsTable = () => supabase.from("strands") as any;
  const schoolId = currentUser.schoolId!;

  // Verify strand exists and belongs to school
  const { data: strand } = await strandsTable()
    .select("strand_id")
    .eq("strand_id", payload.strandId)
    .eq("school_id", schoolId)
    .maybeSingle();

  if (!strand) {
    return { success: false, message: "Strand not found in your school." };
  }

  // Check duplicate
  const { data: existing } = await subStrandsTable()
    .select("sub_strand_id")
    .eq("strand_id", payload.strandId)
    .eq("name", payload.name)
    .maybeSingle();

  if (existing) {
    return {
      success: false,
      message: "A sub-strand with this name already exists under this strand.",
    };
  }

  const { data, error } = await subStrandsTable()
    .insert({
      school_id: schoolId,
      strand_id: payload.strandId,
      name: payload.name,
      description: payload.description || null,
      sort_order: payload.sortOrder ?? 0,
    })
    .select("sub_strand_id")
    .single();

  if (error) {
    return { success: false, message: `Creation failed: ${error.message}` };
  }

  return {
    success: true,
    message: "Sub-strand created successfully.",
    id: (data as any).sub_strand_id,
  };
}

// ============================================================
// UPDATE SUB-STRAND
// ============================================================
export async function updateSubStrand(
  subStrandId: string,
  payload: UpdateSubStrandInput,
  currentUser: AuthUser,
): Promise<{ success: boolean; message: string }> {
  const supabase = await createSupabaseServerClient();
  const subStrandsTable = () => supabase.from("sub_strands") as any;

  const updateData: Record<string, any> = {};
  if (payload.name !== undefined) updateData.name = payload.name;
  if (payload.description !== undefined)
    updateData.description = payload.description || null;
  if (payload.sortOrder !== undefined)
    updateData.sort_order = payload.sortOrder;

  let query = subStrandsTable().update(updateData).eq("sub_strand_id", subStrandId);

  if (currentUser.role !== "super_admin") {
    query = query.eq("school_id", currentUser.schoolId!);
  }

  const { error } = await query;

  if (error) {
    return { success: false, message: `Update failed: ${error.message}` };
  }

  return { success: true, message: "Sub-strand updated successfully." };
}

// ============================================================
// DELETE SUB-STRAND (only if no competencies exist)
// ============================================================
export async function deleteSubStrand(
  subStrandId: string,
  currentUser: AuthUser,
): Promise<{ success: boolean; message: string }> {
  const supabase = await createSupabaseServerClient();
  const subStrandsTable = () => supabase.from("sub_strands") as any;
  const competenciesTable = () => supabase.from("competencies") as any;

  const { count } = await competenciesTable()
    .select("competency_id", { count: "exact", head: true })
    .eq("sub_strand_id", subStrandId);

  if (count && count > 0) {
    return {
      success: false,
      message:
        "Cannot delete sub-strand with existing competencies. Remove competencies first.",
    };
  }

  let query = subStrandsTable().delete().eq("sub_strand_id", subStrandId);

  if (currentUser.role !== "super_admin") {
    query = query.eq("school_id", currentUser.schoolId!);
  }

  const { error } = await query;

  if (error) {
    return { success: false, message: `Deletion failed: ${error.message}` };
  }

  return { success: true, message: "Sub-strand deleted successfully." };
}
