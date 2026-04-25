// features/assessments/services/performanceLevels.service.ts
// ============================================================
// Performance Levels service
// CBC 4-point scale: Below Expectation (1), Approaching (2),
//                    Meeting (3), Exceeding (4)
// Includes score-to-level mapping logic
// ============================================================

import {
  createSupabaseAdminClient,
  createSupabaseServerClient,
} from "@/lib/supabase/server";
import type { AuthUser } from "@/types/auth";
import type { PerformanceLevel, PerformanceLevelLabel } from "../types";

type PerformanceLevelSeed = {
  label: PerformanceLevelLabel;
  name: string;
  numericValue: number;
  description: string;
};

const DEFAULT_PERFORMANCE_LEVELS: PerformanceLevelSeed[] = [
  {
    label: "below_expectation",
    name: "Below Expectation",
    numericValue: 1,
    description:
      "Learner has not achieved the expected competency level. Needs significant support.",
  },
  {
    label: "approaching",
    name: "Approaching Expectation",
    numericValue: 2,
    description:
      "Learner is progressing towards expected competency. Requires additional support.",
  },
  {
    label: "meeting",
    name: "Meeting Expectation",
    numericValue: 3,
    description: "Learner has achieved the expected competency level.",
  },
  {
    label: "exceeding",
    name: "Exceeding Expectation",
    numericValue: 4,
    description:
      "Learner has surpassed the expected competency level. Shows exceptional understanding.",
  },
];

function toPerformanceLevel(row: any): PerformanceLevel {
  return {
    levelId: row.level_id,
    schoolId: row.school_id,
    name: row.name,
    label: row.label as PerformanceLevelLabel,
    numericValue: row.numeric_value,
    description: row.description,
    createdAt: row.created_at,
  };
}

function buildDefaultLevelRows(schoolId: string) {
  return DEFAULT_PERFORMANCE_LEVELS.map((level) => ({
    school_id: schoolId,
    name: level.name,
    label: level.label,
    numeric_value: level.numericValue,
    description: level.description,
  }));
}

async function seedMissingSchoolLevelsWithAdminClient(
  schoolId: string,
): Promise<void> {
  try {
    const admin = await createSupabaseAdminClient();
    const { data: existingLevels, error: existingError } = await admin
      .from("performance_levels")
      .select("label")
      .eq("school_id", schoolId);

    if (existingError) {
      return;
    }

    const existingLabels = new Set(
      (existingLevels ?? []).map((row: any) => row.label),
    );

    const missingRows = buildDefaultLevelRows(schoolId).filter(
      (row) => !existingLabels.has(row.label),
    );

    if (missingRows.length === 0) {
      return;
    }

    await admin.from("performance_levels").insert(missingRows);
  } catch {
    // Ignore auto-seed failures here; caller will fall back to current state.
  }
}

// ============================================================
// SCORE TO LEVEL MAPPING
// Core business logic for CBC assessment
// ============================================================
export function mapScoreToLevel(score: number): PerformanceLevelLabel {
  if (score >= 4) {
    return "exceeding";
  }
  if (score >= 3) {
    return "meeting";
  }
  if (score >= 2) {
    return "approaching";
  }
  return "below_expectation";
}

export function mapScoreToNumericLevel(score: number): number {
  if (score >= 3.5) {
    return 4; // Exceeding
  }
  if (score >= 2.5) {
    return 3; // Meeting
  }
  if (score >= 1.5) {
    return 2; // Approaching
  }
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

  return (data || []).map(toPerformanceLevel);
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

  if (error || !data) {
    return null;
  }

  return toPerformanceLevel(data);
}

// ============================================================
// GET PERFORMANCE LEVEL BY LABEL
// ============================================================
export async function getPerformanceLevelByLabel(
  label: PerformanceLevelLabel,
  currentUser: AuthUser,
): Promise<PerformanceLevel | null> {
  const supabase = await createSupabaseServerClient();
  const schoolId = currentUser.schoolId;

  // First try school-specific configuration.
  if (schoolId) {
    const { data: schoolLevels, error: schoolError } = await supabase
      .from("performance_levels")
      .select("*")
      .eq("label", label)
      .eq("school_id", schoolId)
      .order("numeric_value", { ascending: true })
      .limit(1);

    if (schoolError) {
      return null;
    }

    if (schoolLevels && schoolLevels.length > 0) {
      return toPerformanceLevel(schoolLevels[0]);
    }
  }

  // Fall back to global performance levels (if accessible by policy).
  const { data: globalLevels, error: globalError } = await supabase
    .from("performance_levels")
    .select("*")
    .eq("label", label)
    .is("school_id", null)
    .order("numeric_value", { ascending: true })
    .limit(1);

  if (globalError || !globalLevels || globalLevels.length === 0) {
    return null;
  }

  return toPerformanceLevel(globalLevels[0]);
}

async function seedMissingSchoolLevelsForUser(
  currentUser: AuthUser,
): Promise<void> {
  if (!currentUser.schoolId) {
    return;
  }

  // Try user-scoped seeding first (works for admin-level users).
  const userSeedResult = await seedDefaultPerformanceLevels(currentUser);
  if (userSeedResult.success) {
    return;
  }

  // Fallback to admin client so teacher workflows still recover cleanly.
  await seedMissingSchoolLevelsWithAdminClient(currentUser.schoolId);
}

// ============================================================
// GET LEVEL ID FOR SCORE (used when creating assessments)
// ============================================================
export async function getLevelIdForScore(
  score: number,
  currentUser: AuthUser,
): Promise<string | null> {
  const label = mapScoreToLevel(score);
  let level = await getPerformanceLevelByLabel(label, currentUser);

  if (level?.levelId) {
    return level.levelId;
  }

  await seedMissingSchoolLevelsForUser(currentUser);
  level = await getPerformanceLevelByLabel(label, currentUser);

  return level?.levelId || null;
}

// ============================================================
// SEED DEFAULT PERFORMANCE LEVELS (run once per school)
// ============================================================
export async function seedDefaultPerformanceLevels(
  currentUser: AuthUser,
): Promise<{ success: boolean; message: string }> {
  if (!currentUser.schoolId) {
    return {
      success: false,
      message: "School context is required to seed performance levels.",
    };
  }

  const supabase = await createSupabaseServerClient();
  const schoolId = currentUser.schoolId;

  const { data: existingLevels, error: existingError } = await supabase
    .from("performance_levels")
    .select("label")
    .eq("school_id", schoolId);

  if (existingError) {
    return {
      success: false,
      message: `Failed to check existing levels: ${existingError.message}`,
    };
  }

  const existingLabels = new Set(
    (existingLevels ?? []).map((row: any) => row.label),
  );
  const rowsToInsert = buildDefaultLevelRows(schoolId).filter(
    (row) => !existingLabels.has(row.label),
  );

  if (rowsToInsert.length === 0) {
    return {
      success: true,
      message: "Performance levels already exist for this school.",
    };
  }

  const { error } = await supabase.from("performance_levels").insert(rowsToInsert);

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
