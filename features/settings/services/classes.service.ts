// features/settings/services/classes.service.ts
// Class management service

import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { ClassInfo } from "../types";
import type {
  CreateClassInput,
  UpdateClassInput,
} from "../validators/settings.schema";
import { getSchoolSettings } from "./school.service";

export async function getClasses(
  schoolId: string,
  filters?: {
    academic_year?: string;
    grade_level?: number;
    status?: string;
  },
): Promise<{ success: boolean; data: ClassInfo[]; message?: string }> {
  const supabase = await createSupabaseServerClient();
  let query = supabase
    .from("classes")
    .select(
      `
      class_id,
      school_id,
      name,
      stream,
      capacity,
      class_teacher_id,
      academic_year_id,
      is_active,
      created_at,
      updated_at,
      grades!inner(name, level_order),
      academic_years!inner(year),
      class_teacher:users!class_teacher_id(first_name, last_name),
      student_count:student_classes(count)
    `,
    )
    .eq("school_id", schoolId);

  if (filters?.academic_year) {
    query = query.eq("academic_years.year", filters.academic_year);
  }
  if (filters?.grade_level) {
    query = query.eq("grades.level_order", filters.grade_level);
  }
  if (filters?.status && filters.status !== "all") {
    query = query.eq("is_active", filters.status === "active");
  } else if (!filters?.status) {
    query = query.eq("is_active", true);
  }

  const { data, error } = await query.order("name");

  if (error) {
    return { success: false, data: [], message: error.message };
  }

  // Transform student_count from aggregate
  const classes = (data || [])
    .map((c: any) => ({
      class_id: c.class_id,
      name: c.name,
      grade_level: c.grades?.level_order ?? 0,
      stream: c.stream ?? undefined,
      capacity: c.capacity ?? 0,
      class_teacher_id: c.class_teacher_id ?? undefined,
      academic_year: c.academic_years?.year ?? "",
      status: c.is_active ? "active" : "inactive",
      school_id: c.school_id,
      created_at: c.created_at,
      updated_at: c.updated_at,
      class_teacher: c.class_teacher ?? undefined,
      student_count: c.student_count?.[0]?.count || 0,
    }))
    .sort((a, b) => a.grade_level - b.grade_level || a.name.localeCompare(b.name));

  return { success: true, data: classes as ClassInfo[] };
}

export async function getClassById(
  classId: string,
  schoolId: string,
): Promise<{ success: boolean; data?: ClassInfo; message?: string }> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("classes")
    .select(
      `
      *,
      class_teacher:users!class_teacher_id(first_name, last_name)
    `,
    )
    .eq("class_id", classId)
    .eq("school_id", schoolId)
    .single();

  if (error) {
    return { success: false, message: error.message };
  }

  // Get student count
  const { count } = await supabase
    .from("student_classes")
    .select("*", { count: "exact", head: true })
    .eq("class_id", classId)
    .eq("school_id", schoolId)
    .eq("status", "active");

  return {
    success: true,
    data: { ...(data as any), student_count: count || 0 } as ClassInfo,
  };
}

export async function createClass(
  input: CreateClassInput,
  schoolId: string,
): Promise<{ success: boolean; id?: string; message: string }> {
  const supabase = await createSupabaseServerClient();
  const { data: academicYear } = await supabase
    .from("academic_years")
    .select("academic_year_id")
    .eq("school_id", schoolId)
    .eq("year", input.academic_year)
    .maybeSingle();

  if (!academicYear) {
    return {
      success: false,
      message: `Academic year ${input.academic_year} does not exist`,
    };
  }

  const { data: grade } = await supabase
    .from("grades")
    .select("grade_id")
    .eq("school_id", schoolId)
    .eq("level_order", input.grade_level)
    .maybeSingle();

  if (!grade) {
    return {
      success: false,
      message: `Grade ${input.grade_level} does not exist`,
    };
  }

  // Check for duplicate
  const { data: existing } = await supabase
    .from("classes")
    .select("class_id")
    .eq("name", input.name)
    .eq("school_id", schoolId)
    .eq("academic_year_id", (academicYear as any).academic_year_id)
    .maybeSingle();

  if (existing) {
    return {
      success: false,
      message: `Class "${input.name}" already exists for ${input.academic_year}`,
    };
  }

  // Verify teacher exists if provided
  if (input.class_teacher_id) {
    const { data: teacher } = await supabase
      .from("staff")
      .select("staff_id")
      .eq("user_id", input.class_teacher_id)
      .eq("school_id", schoolId)
      .eq("status", "active")
      .maybeSingle();

    if (!teacher) {
      return {
        success: false,
        message: "Class teacher not found or not active",
      };
    }
  }

  const { data, error } = await (supabase
    .from("classes") as any)
    .insert({
      name: input.name,
      grade_id: (grade as any).grade_id,
      stream: input.stream || null,
      capacity: input.capacity,
      class_teacher_id: input.class_teacher_id || null,
      academic_year_id: (academicYear as any).academic_year_id,
      is_active: true,
      school_id: schoolId,
    })
    .select("class_id")
    .single();

  if (error) {
    return { success: false, message: error.message };
  }

  return {
    success: true,
    id: (data as any).class_id,
    message: `Class "${input.name}" created`,
  };
}

export async function updateClass(
  classId: string,
  input: UpdateClassInput,
  schoolId: string,
): Promise<{ success: boolean; message: string }> {
  const supabase = await createSupabaseServerClient();
  const updateData: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  if (input.name !== undefined) {
    updateData.name = input.name;
  }
  if (input.stream !== undefined) {
    updateData.stream = input.stream === "" ? null : input.stream;
  }
  if (input.capacity !== undefined) {
    updateData.capacity = input.capacity;
  }
  if (input.status !== undefined) {
    updateData.is_active = input.status === "active";
  }

  if (input.class_teacher_id !== undefined) {
    if (input.class_teacher_id === "") {
      updateData.class_teacher_id = null;
    } else {
      // Verify teacher
      const { data: teacher } = await supabase
        .from("staff")
        .select("staff_id")
        .eq("user_id", input.class_teacher_id)
        .eq("school_id", schoolId)
        .eq("status", "active")
        .maybeSingle();

      if (!teacher) {
        return { success: false, message: "Teacher not found or not active" };
      }
      updateData.class_teacher_id = input.class_teacher_id;
    }
  }

  const { error } = await (supabase
    .from("classes") as any)
    .update(updateData)
    .eq("class_id", classId)
    .eq("school_id", schoolId);

  if (error) {
    return { success: false, message: error.message };
  }

  return { success: true, message: "Class updated" };
}

export async function deleteClass(
  classId: string,
  schoolId: string,
): Promise<{ success: boolean; message: string }> {
  const supabase = await createSupabaseServerClient();
  // Check for students
  const { count } = await supabase
    .from("student_classes")
    .select("*", { count: "exact", head: true })
    .eq("class_id", classId)
    .eq("school_id", schoolId)
    .eq("status", "active");

  if (count && count > 0) {
    return {
      success: false,
      message: `Cannot delete class with ${count} active students. Deactivate instead.`,
    };
  }

  // Soft delete
  const { error } = await (supabase
    .from("classes") as any)
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq("class_id", classId)
    .eq("school_id", schoolId);

  if (error) {
    return { success: false, message: error.message };
  }

  return { success: true, message: "Class deactivated" };
}

// ============================================================
// SYSTEM CONFIG (combined data for frontend)
// ============================================================

export async function getSystemConfig(
  schoolId: string,
): Promise<{ success: boolean; data?: any; message?: string }> {
  const supabase = await createSupabaseServerClient();
  // Fetch all config data in parallel
  const [schoolResult, yearsResult, activeYearResult, activeTermResult] =
    await Promise.all([
      supabase.from("schools").select("*").eq("school_id", schoolId).single(),
      supabase
        .from("academic_years")
        .select("*")
        .eq("school_id", schoolId)
        .order("year", { ascending: false }),
      supabase
        .from("academic_years")
        .select("*")
        .eq("school_id", schoolId)
        .eq("is_active", true)
        .maybeSingle(),
      supabase
        .from("terms")
        .select("*")
        .eq("school_id", schoolId)
        .eq("is_active", true)
        .maybeSingle(),
    ]);

  // Get terms for active year if exists
  let terms: any[] = [];
  if (activeYearResult.data) {
    const termsResult = await supabase
      .from("terms")
      .select("*")
      .eq("academic_year_id", (activeYearResult.data as any).academic_year_id)
      .eq("school_id", schoolId)
      .order("name");

    terms = termsResult.data || [];
  }

  // Get active classes
  const classesResult = await supabase
    .from("classes")
    .select(
      `
      *,
      class_teacher:users!class_teacher_id(first_name, last_name)
    `,
    )
    .eq("school_id", schoolId)
    .eq("is_active", true)
    .order("name");

  const settingsResult = await getSchoolSettings(schoolId);

  if (!settingsResult.success) {
    return {
      success: false,
      message: settingsResult.message || "Failed to load school settings",
    };
  }

  return {
    success: true,
    data: {
      school: schoolResult.data,
      academic_years: yearsResult.data || [],
      active_year: activeYearResult.data || null,
      active_term: activeTermResult.data || null,
      terms,
      classes: classesResult.data || [],
      settings: settingsResult.data || null,
    },
  };
}
