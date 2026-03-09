// features/academics/services/hierarchy.service.ts
// ============================================================
// CBC Hierarchy service
// Builds the full Learning Area → Strand → Sub-Strand → Competency tree
// Used for report generation, assessment forms, and analytics
// ============================================================

import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { AuthUser } from "@/types/auth";
import type { CBCHierarchy } from "../types";

// ============================================================
// GET FULL CBC HIERARCHY FOR A LEARNING AREA
// ============================================================
export async function getCBCHierarchy(
  learningAreaId: string,
  currentUser: AuthUser,
): Promise<CBCHierarchy | null> {
  const supabase = await createSupabaseServerClient();
  const learningAreasTable = () => supabase.from("learning_areas") as any;
  const strandsTable = () => supabase.from("strands") as any;
  const subStrandsTable = () => supabase.from("sub_strands") as any;
  const competenciesTable = () => supabase.from("competencies") as any;
  const schoolId = currentUser.schoolId!;

  // Fetch learning area
  const { data: la, error: laError } = await learningAreasTable()
    .select("*")
    .eq("learning_area_id", learningAreaId)
    .eq("school_id", schoolId)
    .single();

  if (laError || !la) return null;

  // Fetch all strands
  const { data: strands } = await strandsTable()
    .select("*")
    .eq("learning_area_id", learningAreaId)
    .eq("school_id", schoolId)
    .order("sort_order", { ascending: true });

  // Fetch all sub-strands for these strands
  const strandIds = (strands || []).map((s: any) => s.strand_id);

  const { data: subStrands } = await subStrandsTable()
    .select("*")
    .in("strand_id", strandIds.length > 0 ? strandIds : ["__none__"])
    .eq("school_id", schoolId)
    .order("sort_order", { ascending: true });

  // Fetch all competencies for these sub-strands
  const subStrandIds = (subStrands || []).map((ss: any) => ss.sub_strand_id);

  const { data: competencies } = await competenciesTable()
    .select("*")
    .in("sub_strand_id", subStrandIds.length > 0 ? subStrandIds : ["__none__"])
    .eq("school_id", schoolId)
    .order("sort_order", { ascending: true });

  // Build hierarchy
  const laRow = la as any;
  const hierarchy: CBCHierarchy = {
    learningArea: {
      learningAreaId: laRow.learning_area_id,
      schoolId: laRow.school_id,
      name: laRow.name,
      description: laRow.description,
      isCore: laRow.is_core,
      applicableGrades: laRow.applicable_grades || [],
      createdAt: laRow.created_at,
      updatedAt: laRow.updated_at,
    },
    strands: (strands || []).map((strand: any) => {
      const strandSubStrands = (subStrands || []).filter(
        (ss: any) => ss.strand_id === strand.strand_id,
      );

      return {
        strand: {
          strandId: strand.strand_id,
          schoolId: strand.school_id,
          learningAreaId: strand.learning_area_id,
          name: strand.name,
          description: strand.description,
          sortOrder: strand.sort_order,
          createdAt: strand.created_at,
        },
        subStrands: strandSubStrands.map((ss: any) => {
          const ssCompetencies = (competencies || []).filter(
            (c: any) => c.sub_strand_id === ss.sub_strand_id,
          );

          return {
            subStrand: {
              subStrandId: ss.sub_strand_id,
              schoolId: ss.school_id,
              strandId: ss.strand_id,
              name: ss.name,
              description: ss.description,
              sortOrder: ss.sort_order,
              createdAt: ss.created_at,
            },
            competencies: ssCompetencies.map((c: any) => ({
              competencyId: c.competency_id,
              schoolId: c.school_id,
              subStrandId: c.sub_strand_id,
              name: c.name,
              description: c.description,
              sortOrder: c.sort_order,
              createdAt: c.created_at,
            })),
          };
        }),
      };
    }),
  };

  return hierarchy;
}

// ============================================================
// GET ALL CBC HIERARCHIES (all learning areas)
// Used for full school curriculum overview
// ============================================================
export async function getAllCBCHierarchies(
  currentUser: AuthUser,
): Promise<CBCHierarchy[]> {
  const supabase = await createSupabaseServerClient();
  const learningAreasTable = () => supabase.from("learning_areas") as any;
  const schoolId = currentUser.schoolId!;

  const { data: learningAreas } = await learningAreasTable()
    .select("learning_area_id")
    .eq("school_id", schoolId)
    .order("name", { ascending: true });

  if (!learningAreas || learningAreas.length === 0) return [];

  const hierarchies: CBCHierarchy[] = [];

  for (const la of learningAreas as any[]) {
    const hierarchy = await getCBCHierarchy(la.learning_area_id, currentUser);
    if (hierarchy) {
      hierarchies.push(hierarchy);
    }
  }

  return hierarchies;
}

// ============================================================
// GET COMPETENCY COUNT SUMMARY (for dashboard)
// ============================================================
export async function getCompetencyCountSummary(
  currentUser: AuthUser,
): Promise<{
  totalLearningAreas: number;
  totalStrands: number;
  totalSubStrands: number;
  totalCompetencies: number;
}> {
  const supabase = await createSupabaseServerClient();
  const schoolId = currentUser.schoolId!;

  const [laResult, strandResult, ssResult, compResult] = await Promise.all([
    supabase
      .from("learning_areas")
      .select("learning_area_id", { count: "exact", head: true })
      .eq("school_id", schoolId),
    supabase
      .from("strands")
      .select("strand_id", { count: "exact", head: true })
      .eq("school_id", schoolId),
    supabase
      .from("sub_strands")
      .select("sub_strand_id", { count: "exact", head: true })
      .eq("school_id", schoolId),
    supabase
      .from("competencies")
      .select("competency_id", { count: "exact", head: true })
      .eq("school_id", schoolId),
  ]);

  return {
    totalLearningAreas: laResult.count || 0,
    totalStrands: strandResult.count || 0,
    totalSubStrands: ssResult.count || 0,
    totalCompetencies: compResult.count || 0,
  };
}
