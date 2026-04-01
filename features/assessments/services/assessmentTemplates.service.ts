// features/assessments/services/assessmentTemplates.service.ts
// ============================================================
// Assessment Template CRUD service
// Templates allow teachers to define reusable assessment items per competency
// ============================================================

import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { AuthUser } from "@/types/auth";
import type { AssessmentTemplate } from "../types";
import type {
  CreateAssessmentTemplateInput,
  UpdateAssessmentTemplateInput,
} from "../validators/assessment.schema";

function normalizeTemplateRow(row: any): AssessmentTemplate {
  const competency = Array.isArray(row.competencies) ? row.competencies[0] : row.competencies;
  const learningArea = Array.isArray(row.learning_areas) ? row.learning_areas[0] : row.learning_areas;

  return {
    templateId: row.template_id,
    schoolId: row.school_id,
    competencyId: row.competency_id,
    competencyName: competency?.name,
    learningAreaId: row.learning_area_id,
    learningAreaName: learningArea?.name,
    name: row.name,
    description: row.description ?? null,
    maxScore: row.max_score,
    assessmentType: row.assessment_type as AssessmentTemplate["assessmentType"],
    isActive: row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function listAssessmentTemplates(
  filters: {
    competencyId?: string;
    learningAreaId?: string;
    isActive?: boolean;
    page?: number;
    pageSize?: number;
  },
  currentUser: AuthUser,
): Promise<{ data: AssessmentTemplate[]; count: number; page: number; pageSize: number }> {
  if (!currentUser.schoolId) {
    throw new Error("School context is required.");
  }

  const supabase = await createSupabaseServerClient();
  const page = filters.page ?? 1;
  const pageSize = filters.pageSize ?? 50;
  const offset = (page - 1) * pageSize;

  let query = supabase
    .from("assessment_templates")
    .select(
      `
      template_id,
      school_id,
      competency_id,
      learning_area_id,
      name,
      description,
      max_score,
      assessment_type,
      is_active,
      created_at,
      updated_at,
      competencies(name),
      learning_areas(name)
    `,
      { count: "exact" },
    )
    .eq("school_id", currentUser.schoolId);

  if (filters.competencyId) {
    query = query.eq("competency_id", filters.competencyId);
  }
  if (filters.learningAreaId) {
    query = query.eq("learning_area_id", filters.learningAreaId);
  }
  if (filters.isActive !== undefined) {
    query = query.eq("is_active", filters.isActive);
  }

  const { data, error, count } = await query
    .order("created_at", { ascending: false })
    .range(offset, offset + pageSize - 1);

  if (error) {
    throw new Error(`Failed to list assessment templates: ${error.message}`);
  }

  return {
    data: (data ?? []).map(normalizeTemplateRow),
    count: count ?? 0,
    page,
    pageSize,
  };
}

export async function getAssessmentTemplateById(
  id: string,
  currentUser: AuthUser,
): Promise<AssessmentTemplate | null> {
  if (!currentUser.schoolId) {
    throw new Error("School context is required.");
  }

  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("assessment_templates")
    .select(
      `
      template_id,
      school_id,
      competency_id,
      learning_area_id,
      name,
      description,
      max_score,
      assessment_type,
      is_active,
      created_at,
      updated_at,
      competencies(name),
      learning_areas(name)
    `,
    )
    .eq("template_id", id)
    .eq("school_id", currentUser.schoolId)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  return normalizeTemplateRow(data);
}

export async function createAssessmentTemplate(
  payload: CreateAssessmentTemplateInput,
  currentUser: AuthUser,
): Promise<{ success: boolean; message: string; templateId?: string }> {
  if (!currentUser.schoolId) {
    return { success: false, message: "School context is required." };
  }

  const supabase = await createSupabaseServerClient();

  // Verify competency belongs to the school
  const { data: competency } = await supabase
    .from("competencies")
    .select("competency_id, sub_strands(strands(learning_area_id))")
    .eq("competency_id", payload.competencyId)
    .eq("school_id", currentUser.schoolId)
    .maybeSingle();

  if (!competency) {
    return { success: false, message: "Competency not found for this school." };
  }

  const learningAreaId = (competency as any)?.sub_strands?.strands?.learning_area_id;

  const { data, error } = await supabase
    .from("assessment_templates")
    .insert({
      school_id: currentUser.schoolId,
      competency_id: payload.competencyId,
      learning_area_id: learningAreaId ?? null,
      name: payload.name,
      description: payload.description ?? null,
      max_score: payload.maxScore ?? 4,
      assessment_type: payload.assessmentType ?? "observation",
      is_active: true,
    })
    .select("template_id")
    .single();

  if (error) {
    return { success: false, message: `Failed to create template: ${error.message}` };
  }

  return {
    success: true,
    message: "Assessment template created successfully.",
    templateId: data.template_id,
  };
}

export async function updateAssessmentTemplate(
  id: string,
  payload: UpdateAssessmentTemplateInput,
  currentUser: AuthUser,
): Promise<{ success: boolean; message: string }> {
  if (!currentUser.schoolId) {
    return { success: false, message: "School context is required." };
  }

  const supabase = await createSupabaseServerClient();

  const { data: existing } = await supabase
    .from("assessment_templates")
    .select("template_id")
    .eq("template_id", id)
    .eq("school_id", currentUser.schoolId)
    .maybeSingle();

  if (!existing) {
    return { success: false, message: "Assessment template not found." };
  }

  const updateData: Record<string, unknown> = {};
  if (payload.name !== undefined) updateData.name = payload.name;
  if (payload.description !== undefined) updateData.description = payload.description ?? null;
  if (payload.maxScore !== undefined) updateData.max_score = payload.maxScore;
  if (payload.assessmentType !== undefined) updateData.assessment_type = payload.assessmentType;
  if (payload.isActive !== undefined) updateData.is_active = payload.isActive;

  const { error } = await supabase
    .from("assessment_templates")
    .update(updateData)
    .eq("template_id", id)
    .eq("school_id", currentUser.schoolId);

  if (error) {
    return { success: false, message: `Failed to update template: ${error.message}` };
  }

  return { success: true, message: "Assessment template updated successfully." };
}

export async function deleteAssessmentTemplate(
  id: string,
  currentUser: AuthUser,
): Promise<{ success: boolean; message: string }> {
  if (!currentUser.schoolId) {
    return { success: false, message: "School context is required." };
  }

  const supabase = await createSupabaseServerClient();

  const { data: existing } = await supabase
    .from("assessment_templates")
    .select("template_id")
    .eq("template_id", id)
    .eq("school_id", currentUser.schoolId)
    .maybeSingle();

  if (!existing) {
    return { success: false, message: "Assessment template not found." };
  }

  // Soft delete by setting is_active to false
  const { error } = await supabase
    .from("assessment_templates")
    .update({ is_active: false })
    .eq("template_id", id)
    .eq("school_id", currentUser.schoolId);

  if (error) {
    return { success: false, message: `Failed to delete template: ${error.message}` };
  }

  return { success: true, message: "Assessment template deactivated successfully." };
}
