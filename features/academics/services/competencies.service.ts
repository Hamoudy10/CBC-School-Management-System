// features/academics/services/competencies.service.ts
// ============================================================
// Competencies CRUD service
// Lowest level of CBC hierarchy — assessment targets
// ============================================================

import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { AuthUser } from "@/types/auth";
import type { Competency } from "../types";
import type {
  CreateCompetencyInput,
  UpdateCompetencyInput,
} from "../validators/academic.schema";

// ============================================================
// LIST COMPETENCIES (by sub-strand)
// ============================================================
export async function listCompetencies(
  subStrandId: string,
  currentUser: AuthUser,
): Promise<Competency[]> {
  const supabase = await createSupabaseServerClient();
  const competenciesTable = () => supabase.from("competencies") as any;

  let query = competenciesTable()
    .select(
      `
      *,
      sub_strands (
        name
      )
    `,
    )
    .eq("sub_strand_id", subStrandId);

  if (currentUser.role !== "super_admin") {
    query = query.eq("school_id", currentUser.schoolId!);
  }

  query = query.order("sort_order", { ascending: true });

  const { data, error } = await query;

  if (error) {
    throw new Error(`Failed to list competencies: ${error.message}`);
  }

  return (data || []).map((row: any) => ({
    competencyId: row.competency_id,
    schoolId: row.school_id,
    subStrandId: row.sub_strand_id,
    subStrandName: row.sub_strands?.name || null,
    name: row.name,
    description: row.description,
    sortOrder: row.sort_order,
    createdAt: row.created_at,
  }));
}

// ============================================================
// GET SINGLE COMPETENCY
// ============================================================
export async function getCompetencyById(
  competencyId: string,
  currentUser: AuthUser,
): Promise<Competency | null> {
  const supabase = await createSupabaseServerClient();
  const competenciesTable = () => supabase.from("competencies") as any;

  let query = competenciesTable()
    .select(
      `
      *,
      sub_strands (
        name
      )
    `,
    )
    .eq("competency_id", competencyId);

  if (currentUser.role !== "super_admin") {
    query = query.eq("school_id", currentUser.schoolId!);
  }

  const { data, error } = await query.single();

  if (error || !data) return null;

  const typedData = data as any;
  return {
    competencyId: typedData.competency_id,
    schoolId: typedData.school_id,
    subStrandId: typedData.sub_strand_id,
    subStrandName: typedData.sub_strands?.name || null,
    name: typedData.name,
    description: typedData.description,
    sortOrder: typedData.sort_order,
    createdAt: typedData.created_at,
  };
}

// ============================================================
// CREATE COMPETENCY
// ============================================================
export async function createCompetency(
  payload: CreateCompetencyInput,
  currentUser: AuthUser,
): Promise<{ success: boolean; message: string; id?: string }> {
  const supabase = await createSupabaseServerClient();
  const competenciesTable = () => supabase.from("competencies") as any;
  const subStrandsTable = () => supabase.from("sub_strands") as any;
  const schoolId = currentUser.schoolId!;

  // Verify sub-strand exists
  const { data: ss } = await subStrandsTable()
    .select("sub_strand_id")
    .eq("sub_strand_id", payload.subStrandId)
    .eq("school_id", schoolId)
    .maybeSingle();

  if (!ss) {
    return { success: false, message: "Sub-strand not found in your school." };
  }

  // Check duplicate
  const { data: existing } = await competenciesTable()
    .select("competency_id")
    .eq("sub_strand_id", payload.subStrandId)
    .eq("name", payload.name)
    .eq("school_id", schoolId)
    .maybeSingle();

  if (existing) {
    return {
      success: false,
      message:
        "A competency with this name already exists under this sub-strand.",
    };
  }

 const { data, error } = await competenciesTable()
   .insert({
     school_id: schoolId,
     sub_strand_id: payload.subStrandId,
     name: payload.name,
     description: payload.description || null,
     sort_order: payload.sortOrder ?? 0,
   } as any)
   .select("competency_id")
   .single();

  if (error) {
    return { success: false, message: `Creation failed: ${error.message}` };
  }

 const typedData = data as any;
 return {
   success: true,
   message: "Competency created successfully.",
   id: typedData.competency_id,
 };
}

// ============================================================
// UPDATE COMPETENCY
// ============================================================
export async function updateCompetency(
  competencyId: string,
  payload: UpdateCompetencyInput,
  currentUser: AuthUser,
): Promise<{ success: boolean; message: string }> {
  const supabase = await createSupabaseServerClient();
  const competenciesTable = () => supabase.from("competencies") as any;
  const updateData: Record<string, any> = {};

  if (payload.name !== undefined) updateData.name = payload.name;
  if (payload.description !== undefined) {
    updateData.description = payload.description || null;
  }
  if (payload.sortOrder !== undefined) updateData.sort_order = payload.sortOrder;

  let query = competenciesTable().update(updateData).eq("competency_id", competencyId);

  if (currentUser.role !== "super_admin") {
    query = query.eq("school_id", currentUser.schoolId!);
  }

  const { error } = await query;

  if (error) {
    return { success: false, message: `Update failed: ${error.message}` };
  }

  return { success: true, message: "Competency updated successfully." };
}

// ============================================================
// DELETE COMPETENCY (only if no assessments reference it)
// ============================================================
export async function deleteCompetency(
  competencyId: string,
  currentUser: AuthUser,
): Promise<{ success: boolean; message: string }> {
  const supabase = await createSupabaseServerClient();
  const competenciesTable = () => supabase.from("competencies") as any;
  const assessmentsTable = () => supabase.from("assessments") as any;

  // Check for linked assessments
  const { count } = await assessmentsTable()
    .select("assessment_id", { count: "exact", head: true })
    .eq("competency_id", competencyId);

  if (count && count > 0) {
    return {
      success: false,
      message: "Cannot delete competency with existing assessment records.",
    };
  }

  let query = competenciesTable().delete().eq("competency_id", competencyId);

  if (currentUser.role !== "super_admin") {
    query = query.eq("school_id", currentUser.schoolId!);
  }

  const { error } = await query;

  if (error) {
    return { success: false, message: `Deletion failed: ${error.message}` };
  }

  return { success: true, message: "Competency deleted successfully." };
}
