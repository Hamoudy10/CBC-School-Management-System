// features/academics/services/teacherSubjects.service.ts
// ============================================================
// Teacher-Subject Assignment service
// Maps teachers to learning areas + classes per term
// Controls which teachers can assess which students
// ============================================================

import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { AuthUser } from "@/types/auth";
import type { TeacherSubjectAssignment } from "../types";
import type {
  CreateTeacherSubjectInput,
  TeacherSubjectFiltersInput,
} from "../validators/academic.schema";
import type { PaginatedResponse } from "@/features/users/types";

// ============================================================
// LIST TEACHER SUBJECT ASSIGNMENTS
// ============================================================
export async function listTeacherSubjects(
  filters: TeacherSubjectFiltersInput,
  currentUser: AuthUser,
): Promise<PaginatedResponse<TeacherSubjectAssignment>> {
  const supabase = await createSupabaseServerClient();
  const teacherSubjectsTable = () => supabase.from("teacher_subjects") as any;
  const staffTable = () => supabase.from("staff") as any;
  const learningAreasTable = () => supabase.from("learning_areas") as any;
  const classesTable = () => supabase.from("classes") as any;
  const {
    page,
    pageSize,
    teacherId,
    classId,
    learningAreaId,
    academicYearId,
    termId,
    isActive,
  } = filters;
  const offset = (page - 1) * pageSize;

  let query = teacherSubjectsTable().select(
    `
      *,
      staff!inner (
        staff_id,
        users (
          first_name,
          last_name
        )
      ),
      learning_areas (
        name
      ),
      classes (
        name
      ),
      terms (
        name
      )
    `,
    { count: "exact" },
  );

  // School scoping
  if (currentUser.role !== "super_admin") {
    query = query.eq("school_id", currentUser.schoolId!);
  }

  // Filters
  if (teacherId) query = query.eq("teacher_id", teacherId);
  if (classId) query = query.eq("class_id", classId);
  if (learningAreaId) query = query.eq("learning_area_id", learningAreaId);
  if (academicYearId) query = query.eq("academic_year_id", academicYearId);
  if (termId) query = query.eq("term_id", termId);
  if (isActive !== undefined) query = query.eq("is_active", isActive);

  query = query
    .order("created_at", { ascending: false })
    .range(offset, offset + pageSize - 1);

  const { data, error, count } = await query;

  if (error) {
    throw new Error(`Failed to list teacher subjects: ${error.message}`);
  }

  const items: TeacherSubjectAssignment[] = (data || []).map((row: any) => ({
    id: row.id,
    schoolId: row.school_id,
    teacherId: row.teacher_id,
    teacherName: row.staff?.users
      ? `${row.staff.users.first_name} ${row.staff.users.last_name}`
      : undefined,
    learningAreaId: row.learning_area_id,
    learningAreaName: row.learning_areas?.name || null,
    classId: row.class_id,
    className: row.classes?.name || null,
    academicYearId: row.academic_year_id,
    termId: row.term_id,
    termName: row.terms?.name || null,
    isActive: row.is_active,
    createdAt: row.created_at,
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
// GET ASSIGNMENTS FOR A SPECIFIC TEACHER
// ============================================================
export async function getTeacherAssignments(
  teacherUserId: string,
  academicYearId: string,
  termId: string,
  currentUser: AuthUser,
): Promise<TeacherSubjectAssignment[]> {
  const supabase = await createSupabaseServerClient();
  const staffTable = () => supabase.from("staff") as any;

  // First get staff_id from user_id
  const { data: staffData } = await staffTable()
    .select("staff_id")
    .eq("user_id", teacherUserId)
    .single();

  if (!staffData) return [];

  const result = await listTeacherSubjects(
    {
      teacherId: staffData.staff_id,
      academicYearId,
      termId,
      isActive: true,
      page: 1,
      pageSize: 100,
    },
    currentUser,
  );

  return result.data;
}

// ============================================================
// CREATE TEACHER-SUBJECT ASSIGNMENT
// ============================================================
export async function createTeacherSubject(
  payload: CreateTeacherSubjectInput,
  currentUser: AuthUser,
): Promise<{ success: boolean; message: string; id?: string }> {
  const supabase = await createSupabaseServerClient();
  const teacherSubjectsTable = () => supabase.from("teacher_subjects") as any;
  const staffTable = () => supabase.from("staff") as any;
  const learningAreasTable = () => supabase.from("learning_areas") as any;
  const classesTable = () => supabase.from("classes") as any;
  const schoolId = currentUser.schoolId!;

  // Verify teacher exists in school
  const { data: teacher } = await staffTable()
    .select("staff_id")
    .eq("staff_id", payload.teacherId)
    .eq("school_id", schoolId)
    .maybeSingle();

  if (!teacher) {
    return { success: false, message: "Teacher not found in your school." };
  }

  // Verify learning area exists in school
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

  // Verify class exists in school
  const { data: cls } = await classesTable()
    .select("class_id")
    .eq("class_id", payload.classId)
    .eq("school_id", schoolId)
    .maybeSingle();

  if (!cls) {
    return { success: false, message: "Class not found in your school." };
  }

  // Check for duplicate assignment
  const { data: existing } = await teacherSubjectsTable()
    .select("id")
    .eq("teacher_id", payload.teacherId)
    .eq("learning_area_id", payload.learningAreaId)
    .eq("class_id", payload.classId)
    .eq("academic_year_id", payload.academicYearId)
    .eq("term_id", payload.termId)
    .maybeSingle();

  if (existing) {
    return {
      success: false,
      message:
        "This teacher is already assigned to this subject and class for the selected term.",
    };
  }

  const { data, error } = await teacherSubjectsTable()
    .insert({
      school_id: schoolId,
      teacher_id: payload.teacherId,
      learning_area_id: payload.learningAreaId,
      class_id: payload.classId,
      academic_year_id: payload.academicYearId,
      term_id: payload.termId,
      is_active: true,
    })
    .select("id")
    .single();

  if (error) {
    return { success: false, message: `Assignment failed: ${error.message}` };
  }

  return {
    success: true,
    message: "Teacher assigned to subject successfully.",
    id: (data as any).id,
  };
}

// ============================================================
// DEACTIVATE TEACHER-SUBJECT ASSIGNMENT
// ============================================================
export async function deactivateTeacherSubject(
  assignmentId: string,
  currentUser: AuthUser,
): Promise<{ success: boolean; message: string }> {
  const supabase = await createSupabaseServerClient();
  const teacherSubjectsTable = () => supabase.from("teacher_subjects") as any;

  let query = teacherSubjectsTable()
    .update({ is_active: false })
    .eq("id", assignmentId);

  if (currentUser.role !== "super_admin") {
    query = query.eq("school_id", currentUser.schoolId!);
  }

  const { error } = await query;

  if (error) {
    return { success: false, message: `Deactivation failed: ${error.message}` };
  }

  return { success: true, message: "Assignment deactivated successfully." };
}
