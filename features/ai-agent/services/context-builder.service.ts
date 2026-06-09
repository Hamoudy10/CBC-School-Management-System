import { createSupabaseServerClient } from "@/lib/supabase/server";
import { hasPermission } from "@/lib/auth/permissions";
import { PERMISSION_MATRIX } from "@/types/roles";
import type { AuthUser } from "@/types/auth";
import type { PageContextData } from "@/features/ai-agent/types";

export async function buildPageContext(user: AuthUser): Promise<PageContextData> {
  const supabase = await createSupabaseServerClient();

  let schoolName = "";
  let activeAcademicYear: string | undefined;
  let activeTerm: string | undefined;

  if (user.schoolId) {
    const [schoolResult, yearResult, termResult] = await Promise.all([
      supabase.from("schools").select("name").eq("school_id", user.schoolId).single(),
      supabase
        .from("academic_years")
        .select("name")
        .eq("school_id", user.schoolId)
        .eq("is_active", true)
        .single(),
      supabase
        .from("terms")
        .select("name")
        .eq("school_id", user.schoolId)
        .eq("is_active", true)
        .single(),
    ]);

    schoolName = schoolResult.data?.name ?? "";
    activeAcademicYear = yearResult.data?.name;
    activeTerm = termResult.data?.name;
  }

  const userPermissions = PERMISSION_MATRIX[user.role] ?? {};
  const allowedModules = Object.keys(userPermissions);
  const allowedActions: Record<string, string[]> = {};
  for (const [mod, actions] of Object.entries(userPermissions)) {
    allowedActions[mod] = actions as string[];
  }

  return {
    schoolName,
    activeAcademicYear,
    activeTerm,
    userRole: user.role,
    allowedModules,
    allowedActions,
  };
}

export async function canAccessStudent(
  user: AuthUser,
  studentId: string,
): Promise<boolean> {
  if (user.role === "super_admin" || user.role === "school_admin") return true;
  if (!hasPermission(user.role, "students", "view")) return false;

  const supabase = await createSupabaseServerClient();

  if (user.role === "parent") {
    const { data } = await supabase
      .from("student_guardians")
      .select("student_id")
      .eq("guardian_id", user.id)
      .eq("student_id", studentId)
      .single();
    return !!data;
  }

  if (user.role === "student") {
    return user.id === studentId;
  }

  if (["teacher", "class_teacher", "subject_teacher"].includes(user.role)) {
    const { data } = await supabase
      .from("students")
      .select("student_id")
      .eq("student_id", studentId)
      .eq("school_id", user.schoolId)
      .single();
    return !!data;
  }

  return true;
}

const SENSITIVE_FIELDS = new Set([
  "password_hash",
  "reset_token",
  "auth_provider",
  "mpesa_consumer_key",
  "mpesa_consumer_secret",
  "mpesa_passkey",
  "api_key",
  "secret",
  "token",
]);

export function sanitizeForAgent(
  obj: Record<string, unknown> | Array<unknown> | null | undefined,
): Record<string, unknown> {
  if (!obj) return {};
  if (Array.isArray(obj)) {
    return { items: obj.map((item) => sanitizeForAgent(item as Record<string, unknown>)) };
  }
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    const lower = key.toLowerCase();
    if (SENSITIVE_FIELDS.has(lower) || lower.includes("password") || lower.includes("secret") || lower.includes("token")) {
      result[key] = "[REDACTED]";
    } else if (value !== null && typeof value === "object" && !Array.isArray(value)) {
      result[key] = sanitizeForAgent(value as Record<string, unknown>);
    } else if (Array.isArray(value)) {
      result[key] = (value as unknown[]).map((item) =>
        typeof item === "object" && item !== null
          ? sanitizeForAgent(item as Record<string, unknown>)
          : item,
      );
    } else {
      result[key] = value;
    }
  }
  return result;
}
