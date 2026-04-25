// features/assessments/services/performanceLevels.service.ts
// ============================================================
// Performance Levels service
// CBC 4-point scale: Below Expectation (1), Approaching (2),
//                    Meeting (3), Exceeding (4)
// Includes score-to-level mapping logic
// ============================================================

import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { AuthUser } from "@/types/auth";
import type { PerformanceLevel, PerformanceLevelLabel } from "../types";
import type { CreatePerformanceLevelInput } from "../validators/assessment.schema";

// ============================================================
// SCORE TO LEVEL MAPPING
// Core business logic for CBC assessment
// ============================================================
export function mapScoreToLevel(score: number): PerformanceLevelLabel {
  if (score >= 4) return "exceeding";
  if (score >= 3) return "meeting";
  if (score >= 2) return "approaching";
  return "below_expectation";
}

export function mapScoreToNumericLevel(score: number): number {
  if (score >= 3.5) return 4; // Exceeding
  if (score >= 2.5) return 3; // Meeting
  if (score >= 1.5) return 2; // Approaching
  return 1; // Below Expectation
}

export function getLevelDisplayName(label: PerformanceLevelLabel): string {
  const names: Record<PerformanceLevelLabel, string> = {
    below_expectation: "Below Expectation",
    approaching: "Approaching Expectation",
    meeting: "Meeting Expectation",
    exceeding: "Exceeding Expectation",
  };
  return names[label];
}

export function getLevelColor(label: PerformanceLevelLabel): string {
  const colors: Record<PerformanceLevelLabel, string> = {
    below_expectation: "#EF4444", // Red
    approaching: "#F59E0B", // Amber
    meeting: "#10B981", // Green
    exceeding: "#3B82F6", // Blue
  };
  return colors[label];
}

// ============================================================
// LIST PERFORMANCE LEVELS
// ============================================================
export async function listPerformanceLevels(
  currentUser: AuthUser,
): Promise<PerformanceLevel[]> {
  const supabase = await createSupabaseServerClient();

  let query = supabase.from("performance_levels").select("*");

  if (currentUser.role !== "super_admin") {
    query = query.eq("school_id", currentUser.schoolId!);
  }

  query = query.order("numeric_value", { ascending: true });

  const { data, error } = await query;

  if (error) {
    throw new Error(`Failed to list performance levels: ${error.message}`);
  }

  return (data || []).map((row: any) => ({
    levelId: row.level_id,
    schoolId: row.school_id,
    name: row.name,
    label: row.label as PerformanceLevelLabel,
    numericValue: row.numeric_value,
    description: row.description,
    createdAt: row.created_at,
  }));
}

// ============================================================
// GET PERFORMANCE LEVEL BY ID
// ============================================================
export async function getPerformanceLevelById(
  levelId: string,
  currentUser: AuthUser,
): Promise<PerformanceLevel | null> {
  const supabase = await createSupabaseServerClient();

  let query = supabase
    .from("performance_levels")
    .select("*")
    .eq("level_id", levelId);

  if (currentUser.role !== "super_admin") {
    query = query.eq("school_id", currentUser.schoolId!);
  }

  const { data, error } = await query.single();

  if (error || !data) return null;

  return {
    levelId: data.level_id,
    schoolId: data.school_id,
    name: data.name,
    label: data.label as PerformanceLevelLabel,
    numericValue: data.numeric_value,
    description: data.description,
    createdAt: data.created_at,
  };
}

// ============================================================
// GET PERFORMANCE LEVEL BY LABEL
// ============================================================
export async function getPerformanceLevelByLabel(
  label: PerformanceLevelLabel,
  currentUser: AuthUser,
): Promise<PerformanceLevel | null> {
  const supabase = await createSupabaseServerClient();

  // First try school-specific, then fall back to global (null school_id)
  let { data, error } = await supabase
    .from("performance_levels")
    .select("*")
    .eq("label", label)
    .eq("school_id", currentUser.schoolId!)
    .maybeSingle();

  if (!data) {
    // Fall back to global performance levels
    const global = await supabase
      .from("performance_levels")
      .select("*")
      .eq("label", label)
      .is("school_id", null)
      .maybeSingle();
    
    if (global) {
      data = global;
      error = null;
    }
  }

  if (error || !data) return null;

  return {
    levelId: data.level_id,
    schoolId: data.school_id,
    name: data.name,
    label: data.label as PerformanceLevelLabel,
    numericValue: data.numeric_value,
    description: data.description,
    createdAt: data.created_at,
  };
}

// ============================================================
// GET LEVEL ID FOR SCORE (used when creating assessments)
// ============================================================
export async function getLevelIdForScore(
  score: number,
  currentUser: AuthUser,
): Promise<string | null> {
  const label = mapScoreToLevel(score);
  const level = await getPerformanceLevelByLabel(label, currentUser);
  return level?.levelId || null;
}

// ============================================================
// SEED DEFAULT PERFORMANCE LEVELS (run once per school)
// ============================================================
export async function seedDefaultPerformanceLevels(
  currentUser: AuthUser,
): Promise<{ success: boolean; message: string }> {
  const supabase = await createSupabaseServerClient();
  const schoolId = currentUser.schoolId!;

  // Check if levels already exist
  const { count } = await supabase
    .from("performance_levels")
    .select("level_id", { count: "exact", head: true })
    .eq("school_id", schoolId);

  if (count && count > 0) {
    return {
      success: false,
      message: "Performance levels already exist for this school.",
    };
  }

  const defaultLevels = [
    {
      school_id: schoolId,
      name: "Below Expectation",
      label: "below_expectation",
      numeric_value: 1,
      description:
        "Learner has not achieved the expected competency level. Needs significant support.",
    },
    {
      school_id: schoolId,
      name: "Approaching Expectation",
      label: "approaching",
      numeric_value: 2,
      description:
        "Learner is progressing towards expected competency. Requires additional support.",
    },
    {
      school_id: schoolId,
      name: "Meeting Expectation",
      label: "meeting",
      numeric_value: 3,
      description: "Learner has achieved the expected competency level.",
    },
    {
      school_id: schoolId,
      name: "Exceeding Expectation",
      label: "exceeding",
      numeric_value: 4,
      description:
        "Learner has surpassed the expected competency level. Shows exceptional understanding.",
    },
  ];

  const { error } = await supabase
    .from("performance_levels")
    .insert(defaultLevels);

  if (error) {
    return {
      success: false,
      message: `Failed to seed levels: ${error.message}`,
    };
  }

  return {
    success: true,
    message: "Default performance levels created successfully.",
  };
}
