// features/assessments/services/assessments.service.ts
// ============================================================
// Core assessment CRUD and class roster entry workflows
// ============================================================

import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { AuthUser } from "@/types/auth";
import type { Assessment } from "../types";
import type {
  AssessmentFiltersInput,
  BulkAssessmentInput,
  CreateAssessmentInput,
  UpdateAssessmentInput,
} from "../validators/assessment.schema";
import { getLevelIdForScore } from "./performanceLevels.service";

type AssessmentListResult = {
  data: Assessment[] | Array<Record<string, unknown>>;
  count: number;
  page: number;
  pageSize: number;
};

const TEACHER_ROLES = new Set(["teacher", "class_teacher", "subject_teacher"]);

function getSchoolId(currentUser: AuthUser) {
  if (!currentUser.schoolId) {
    throw new Error("School context is required for assessment operations.");
  }

  return currentUser.schoolId;
}

async function resolveAcademicContext(
  schoolId: string,
  input: {
    academicYearId?: string;
    termId?: string;
  },
) {
  const supabase = await createSupabaseServerClient();
  let academicYearId = input.academicYearId;
  let termId = input.termId;

  if (academicYearId) {
    const { data: academicYear } = await supabase
      .from("academic_years")
      .select("academic_year_id")
      .eq("academic_year_id", academicYearId)
      .eq("school_id", schoolId)
      .maybeSingle();

    if (!academicYear) {
      throw new Error("Academic year not found for this school.");
    }
  } else {
    const { data: activeYear } = await supabase
      .from("academic_years")
      .select("academic_year_id")
      .eq("school_id", schoolId)
      .eq("is_active", true)
      .maybeSingle();

    academicYearId = activeYear?.academic_year_id;
  }

  if (termId) {
    const { data: term } = await supabase
      .from("terms")
      .select("term_id, academic_year_id")
      .eq("term_id", termId)
      .eq("school_id", schoolId)
      .maybeSingle();

    if (!term) {
      throw new Error("Term not found for this school.");
    }

    if (academicYearId && term.academic_year_id !== academicYearId) {
      throw new Error("The selected term does not belong to the selected academic year.");
    }

    academicYearId = academicYearId ?? term.academic_year_id;
  } else {
    let termQuery = supabase
      .from("terms")
      .select("term_id, academic_year_id")
      .eq("school_id", schoolId);

    if (academicYearId) {
      termQuery = termQuery.eq("academic_year_id", academicYearId);
    }

    const { data: activeTerm } = await termQuery
      .eq("is_active", true)
      .order("start_date", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (activeTerm) {
      termId = activeTerm.term_id;
      academicYearId = academicYearId ?? activeTerm.academic_year_id;
    } else if (academicYearId) {
      const { data: firstTerm } = await supabase
        .from("terms")
        .select("term_id, academic_year_id")
        .eq("school_id", schoolId)
        .eq("academic_year_id", academicYearId)
        .order("start_date", { ascending: true })
        .limit(1)
        .maybeSingle();

      termId = firstTerm?.term_id;
    }
  }

  if (!academicYearId || !termId) {
    throw new Error(
      "An active academic year and term are required before recording assessments.",
    );
  }

  return { academicYearId, termId };
}

async function ensureTeacherAssignment(
  schoolId: string,
  classId: string,
  learningAreaId: string,
  academicYearId: string,
  termId: string,
  currentUser: AuthUser,
) {
  if (!TEACHER_ROLES.has(currentUser.role)) {
    return;
  }

  const supabase = await createSupabaseServerClient();
  const { data: staff } = await supabase
    .from("staff")
    .select("staff_id")
    .eq("user_id", currentUser.id)
    .eq("school_id", schoolId)
    .eq("status", "active")
    .maybeSingle();

  if (!staff?.staff_id) {
    throw new Error("Teacher profile not found for the current user.");
  }

  const { data: assignment } = await supabase
    .from("teacher_subjects")
    .select("id")
    .eq("school_id", schoolId)
    .eq("teacher_id", staff.staff_id)
    .eq("class_id", classId)
    .eq("learning_area_id", learningAreaId)
    .eq("academic_year_id", academicYearId)
    .eq("term_id", termId)
    .eq("is_active", true)
    .maybeSingle();

  if (!assignment) {
    throw new Error(
      "You are not assigned to assess this learning area for the selected class and term.",
    );
  }
}

async function verifyAssessmentContext(
  schoolId: string,
  input: {
    classId: string;
    learningAreaId: string;
    competencyId: string;
  },
) {
  const supabase = await createSupabaseServerClient();

  const [classResult, learningAreaResult, competencyResult] = await Promise.all([
    supabase
      .from("classes")
      .select("class_id, name")
      .eq("class_id", input.classId)
      .eq("school_id", schoolId)
      .maybeSingle(),
    supabase
      .from("learning_areas")
      .select("learning_area_id, name")
      .eq("learning_area_id", input.learningAreaId)
      .eq("school_id", schoolId)
      .maybeSingle(),
    supabase
      .from("competencies")
      .select(
        `
        competency_id,
        school_id,
        sub_strands (
          strands (
            learning_area_id
          )
        )
      `,
      )
      .eq("competency_id", input.competencyId)
      .eq("school_id", schoolId)
      .maybeSingle(),
  ]);

  if (!classResult.data) {
    throw new Error("Class not found for this school.");
  }

  if (!learningAreaResult.data) {
    throw new Error("Learning area not found for this school.");
  }

  const competencyLearningAreaId = (competencyResult.data as any)?.sub_strands?.strands
    ?.learning_area_id;

  if (!competencyResult.data || competencyLearningAreaId !== input.learningAreaId) {
    throw new Error("The selected competency does not belong to the selected learning area.");
  }

  return {
    className: classResult.data.name,
    learningAreaName: learningAreaResult.data.name,
  };
}

function normalizeAssessmentRow(row: any): Assessment {
  const student = Array.isArray(row.students) ? row.students[0] : row.students;
  const competency = Array.isArray(row.competencies)
    ? row.competencies[0]
    : row.competencies;
  const learningArea = Array.isArray(row.learning_areas)
    ? row.learning_areas[0]
    : row.learning_areas;
  const classRecord = Array.isArray(row.classes) ? row.classes[0] : row.classes;
  const academicYear = Array.isArray(row.academic_years)
    ? row.academic_years[0]
    : row.academic_years;
  const term = Array.isArray(row.terms) ? row.terms[0] : row.terms;
  const level = Array.isArray(row.performance_levels)
    ? row.performance_levels[0]
    : row.performance_levels;
  return {
    assessmentId: row.assessment_id,
    schoolId: row.school_id,
    studentId: row.student_id,
    studentName: student
      ? [student.first_name, student.last_name].filter(Boolean).join(" ")
      : undefined,
    studentAdmissionNo: student?.admission_number,
    competencyId: row.competency_id,
    competencyName: competency?.name,
    learningAreaId: row.learning_area_id,
    learningAreaName: learningArea?.name,
    classId: row.class_id,
    className: classRecord?.name,
    academicYearId: row.academic_year_id,
    academicYear: academicYear?.year,
    termId: row.term_id,
    termName: term?.name,
    score: row.score,
    levelId: row.level_id,
    levelName: level?.name,
    levelLabel: level?.label,
    remarks: row.remarks ?? null,
    assessmentDate: row.assessment_date,
    assessedBy: row.assessed_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function listAssessments(
  filters: AssessmentFiltersInput,
  currentUser: AuthUser,
): Promise<AssessmentListResult> {
  const schoolId = getSchoolId(currentUser);
  const supabase = await createSupabaseServerClient();
  const page = filters.page ?? 1;
  const pageSize = filters.pageSize ?? 50;

  if (filters.classId && filters.competencyId) {
    const { academicYearId, termId } = await resolveAcademicContext(schoolId, {
      academicYearId: filters.academicYearId,
      termId: filters.termId,
    });

    const { data: classRoster, error: rosterError } = await supabase
      .from("student_classes")
      .select(
        `
        student_id,
        students!inner (
          student_id,
          first_name,
          last_name,
          admission_number,
          photo_url
        )
      `,
      )
      .eq("school_id", schoolId)
      .eq("class_id", filters.classId)
      .eq("academic_year_id", academicYearId)
      .eq("term_id", termId)
      .eq("status", "active");

    if (rosterError) {
      throw new Error(`Failed to load class roster: ${rosterError.message}`);
    }

    const studentIds = (classRoster ?? []).map((row: any) => row.student_id);

    const { data: assessments, error: assessmentsError } = studentIds.length
      ? await supabase
          .from("assessments")
          .select("assessment_id, student_id, score, remarks, updated_at")
          .eq("school_id", schoolId)
          .eq("class_id", filters.classId)
          .eq("competency_id", filters.competencyId)
          .eq("academic_year_id", academicYearId)
          .eq("term_id", termId)
          .in("student_id", studentIds)
      : { data: [], error: null };

    if (assessmentsError) {
      throw new Error(`Failed to load assessments: ${assessmentsError.message}`);
    }

    const assessmentMap = new Map(
      (assessments ?? []).map((row: any) => [
        row.student_id,
        {
          assessmentId: row.assessment_id,
          score: row.score,
          remarks: row.remarks ?? null,
          updatedAt: row.updated_at,
        },
      ]),
    );

    const data = (classRoster ?? [])
      .map((row: any) => {
        const student = Array.isArray(row.students) ? row.students[0] : row.students;
        const assessment = assessmentMap.get(row.student_id);

        return {
          student_id: row.student_id,
          studentId: row.student_id,
          full_name: [student?.first_name, student?.last_name]
            .filter(Boolean)
            .join(" "),
          fullName: [student?.first_name, student?.last_name]
            .filter(Boolean)
            .join(" "),
          admission_number: student?.admission_number ?? "",
          admissionNumber: student?.admission_number ?? "",
          photo_url: student?.photo_url ?? null,
          photoUrl: student?.photo_url ?? null,
          assessment_id: assessment?.assessmentId ?? null,
          assessmentId: assessment?.assessmentId ?? null,
          score: assessment?.score ?? null,
          remarks: assessment?.remarks ?? null,
          updated_at: assessment?.updatedAt ?? null,
          updatedAt: assessment?.updatedAt ?? null,
        };
      })
      .sort((left, right) => left.full_name.localeCompare(right.full_name));

    return {
      data,
      count: data.length,
      page: 1,
      pageSize: data.length || pageSize,
    };
  }

  let query = supabase
    .from("assessments")
    .select(
      `
      assessment_id,
      school_id,
      student_id,
      competency_id,
      learning_area_id,
      class_id,
      academic_year_id,
      term_id,
      score,
      level_id,
      remarks,
      assessment_date,
      assessed_by,
      created_at,
      updated_at,
      students(first_name, last_name, admission_number),
      competencies(name),
      learning_areas(name),
      classes(name),
      academic_years(year),
      terms(name),
      performance_levels(name, label)
    `,
      { count: "exact" },
    )
    .eq("school_id", schoolId);

  if (filters.studentId) {
    query = query.eq("student_id", filters.studentId);
  }
  if (filters.classId) {
    query = query.eq("class_id", filters.classId);
  }
  if (filters.learningAreaId) {
    query = query.eq("learning_area_id", filters.learningAreaId);
  }
  if (filters.competencyId) {
    query = query.eq("competency_id", filters.competencyId);
  }
  if (filters.academicYearId) {
    query = query.eq("academic_year_id", filters.academicYearId);
  }
  if (filters.termId) {
    query = query.eq("term_id", filters.termId);
  }
  if (filters.assessedBy) {
    query = query.eq("assessed_by", filters.assessedBy);
  }
  if (filters.startDate) {
    query = query.gte("assessment_date", filters.startDate);
  }
  if (filters.endDate) {
    query = query.lte("assessment_date", filters.endDate);
  }

  const offset = (page - 1) * pageSize;
  const { data, error, count } = await query
    .order("assessment_date", { ascending: false })
    .range(offset, offset + pageSize - 1);

  if (error) {
    throw new Error(`Failed to list assessments: ${error.message}`);
  }

  return {
    data: (data ?? []).map(normalizeAssessmentRow),
    count: count ?? 0,
    page,
    pageSize,
  };
}

export async function getAssessmentById(
  id: string,
  currentUser: AuthUser,
): Promise<Assessment | null> {
  const schoolId = getSchoolId(currentUser);
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("assessments")
    .select(
      `
      assessment_id,
      school_id,
      student_id,
      competency_id,
      learning_area_id,
      class_id,
      academic_year_id,
      term_id,
      score,
      level_id,
      remarks,
      assessment_date,
      assessed_by,
      created_at,
      updated_at,
      students(first_name, last_name, admission_number),
      competencies(name),
      learning_areas(name),
      classes(name),
      academic_years(year),
      terms(name),
      performance_levels(name, label)
    `,
    )
    .eq("assessment_id", id)
    .eq("school_id", schoolId)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  return normalizeAssessmentRow(data);
}

export async function createAssessment(
  payload: CreateAssessmentInput,
  currentUser: AuthUser,
): Promise<{ success: boolean; message: string; assessmentId?: string }> {
  try {
    if (payload.score === null) {
      return {
        success: false,
        message: "Score is required.",
      };
    }

    const schoolId = getSchoolId(currentUser);
    const { academicYearId, termId } = await resolveAcademicContext(schoolId, {
      academicYearId: payload.academicYearId,
      termId: payload.termId,
    });

    await verifyAssessmentContext(schoolId, payload);
    await ensureTeacherAssignment(
      schoolId,
      payload.classId,
      payload.learningAreaId,
      academicYearId,
      termId,
      currentUser,
    );

    const supabase = await createSupabaseServerClient();
    const levelId = await getLevelIdForScore(payload.score, currentUser);

    if (!levelId) {
      return {
        success: false,
        message: "Performance levels are not configured for this school.",
      };
    }

    const { data: existing } = await supabase
      .from("assessments")
      .select("assessment_id")
      .eq("school_id", schoolId)
      .eq("student_id", payload.studentId)
      .eq("competency_id", payload.competencyId)
      .eq("academic_year_id", academicYearId)
      .eq("term_id", termId)
      .maybeSingle();

    if (existing) {
      return {
        success: false,
        message: "An assessment for this student and competency already exists in the selected term.",
      };
    }

    const { data, error } = await supabase
      .from("assessments")
      .insert({
        school_id: schoolId,
        student_id: payload.studentId,
        competency_id: payload.competencyId,
        learning_area_id: payload.learningAreaId,
        class_id: payload.classId,
        academic_year_id: academicYearId,
        term_id: termId,
        score: payload.score,
        level_id: levelId,
        remarks: payload.remarks || null,
        assessment_date: payload.assessmentDate ?? new Date().toISOString().slice(0, 10),
        assessed_by: currentUser.id,
        updated_by: currentUser.id,
      })
      .select("assessment_id")
      .single();

    if (error) {
      return { success: false, message: `Failed to create assessment: ${error.message}` };
    }

    return {
      success: true,
      message: "Assessment recorded successfully.",
      assessmentId: data.assessment_id,
    };
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : "Failed to create assessment.",
    };
  }
}

export async function updateAssessment(
  id: string,
  payload: UpdateAssessmentInput,
  currentUser: AuthUser,
): Promise<{ success: boolean; message: string }> {
  try {
    const schoolId = getSchoolId(currentUser);
    const supabase = await createSupabaseServerClient();

    const { data: existing } = await supabase
      .from("assessments")
      .select("assessment_id, class_id, learning_area_id, academic_year_id, term_id")
      .eq("assessment_id", id)
      .eq("school_id", schoolId)
      .maybeSingle();

    if (!existing) {
      return { success: false, message: "Assessment not found." };
    }

    await ensureTeacherAssignment(
      schoolId,
      existing.class_id,
      existing.learning_area_id,
      existing.academic_year_id,
      existing.term_id,
      currentUser,
    );

    const updateData: Record<string, unknown> = {
      updated_by: currentUser.id,
    };

    if (payload.score !== undefined) {
      const levelId = await getLevelIdForScore(payload.score, currentUser);

      if (!levelId) {
        return {
          success: false,
          message: "Performance levels are not configured for this school.",
        };
      }

      updateData.score = payload.score;
      updateData.level_id = levelId;
    }

    if (payload.remarks !== undefined) {
      updateData.remarks = payload.remarks || null;
    }

    if (payload.assessmentDate !== undefined) {
      updateData.assessment_date = payload.assessmentDate;
    }

    const { error } = await supabase
      .from("assessments")
      .update(updateData)
      .eq("assessment_id", id)
      .eq("school_id", schoolId);

    if (error) {
      return { success: false, message: `Failed to update assessment: ${error.message}` };
    }

    return { success: true, message: "Assessment updated successfully." };
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : "Failed to update assessment.",
    };
  }
}

export async function bulkCreateAssessments(
  payload: BulkAssessmentInput,
  currentUser: AuthUser,
): Promise<{
  success: boolean;
  message: string;
  created: number;
  updated: number;
  failed: number;
}> {
  try {
    const schoolId = getSchoolId(currentUser);
    const { academicYearId, termId } = await resolveAcademicContext(schoolId, {
      academicYearId: payload.academicYearId,
      termId: payload.termId,
    });

    await verifyAssessmentContext(schoolId, payload);
    await ensureTeacherAssignment(
      schoolId,
      payload.classId,
      payload.learningAreaId,
      academicYearId,
      termId,
      currentUser,
    );

    const supabase = await createSupabaseServerClient();
    const studentIds = payload.assessments.map((entry) => entry.studentId);
    const uniqueStudentIds = [...new Set(studentIds)];

    const { data: roster, error: rosterError } = await supabase
      .from("student_classes")
      .select("student_id")
      .eq("school_id", schoolId)
      .eq("class_id", payload.classId)
      .eq("academic_year_id", academicYearId)
      .eq("term_id", termId)
      .eq("status", "active")
      .in("student_id", uniqueStudentIds);

    if (rosterError) {
      return {
        success: false,
        message: `Failed to verify class roster: ${rosterError.message}`,
        created: 0,
        updated: 0,
        failed: payload.assessments.length,
      };
    }

    const activeStudentIds = new Set((roster ?? []).map((row: any) => row.student_id));

    if (activeStudentIds.size !== uniqueStudentIds.length) {
      return {
        success: false,
        message: "One or more students are not active in the selected class for the selected term.",
        created: 0,
        updated: 0,
        failed: payload.assessments.length,
      };
    }

    const levelIds = new Map<number, string>();
    for (const score of [1, 2, 3, 4]) {
      const levelId = await getLevelIdForScore(score, currentUser);
      if (!levelId) {
        return {
          success: false,
          message: "Performance levels are not configured for this school.",
          created: 0,
          updated: 0,
          failed: payload.assessments.length,
        };
      }
      levelIds.set(score, levelId);
    }

    const { data: existingAssessments, error: existingError } = await supabase
      .from("assessments")
      .select("assessment_id, student_id")
      .eq("school_id", schoolId)
      .eq("class_id", payload.classId)
      .eq("competency_id", payload.competencyId)
      .eq("academic_year_id", academicYearId)
      .eq("term_id", termId)
      .in("student_id", uniqueStudentIds);

    if (existingError) {
      return {
        success: false,
        message: `Failed to load existing assessments: ${existingError.message}`,
        created: 0,
        updated: 0,
        failed: payload.assessments.length,
      };
    }

    const existingMap = new Map(
      (existingAssessments ?? []).map((row: any) => [row.student_id, row.assessment_id]),
    );

    let created = 0;
    let updated = 0;
    let failed = 0;

    for (const entry of payload.assessments) {
      const levelId = levelIds.get(entry.score);
      const assessmentPayload = {
        score: entry.score,
        level_id: levelId,
        remarks: entry.remarks || null,
        assessment_date: new Date().toISOString().slice(0, 10),
        assessed_by: currentUser.id,
        updated_by: currentUser.id,
      };

      if (existingMap.has(entry.studentId)) {
        const { error } = await supabase
          .from("assessments")
          .update(assessmentPayload)
          .eq("assessment_id", existingMap.get(entry.studentId))
          .eq("school_id", schoolId);

        if (error) {
          failed += 1;
        } else {
          updated += 1;
        }
      } else {
        const { error } = await supabase.from("assessments").insert({
          school_id: schoolId,
          student_id: entry.studentId,
          competency_id: payload.competencyId,
          learning_area_id: payload.learningAreaId,
          class_id: payload.classId,
          academic_year_id: academicYearId,
          term_id: termId,
          score: entry.score,
          level_id: levelId,
          remarks: entry.remarks || null,
          assessment_date: new Date().toISOString().slice(0, 10),
          assessed_by: currentUser.id,
          updated_by: currentUser.id,
        });

        if (error) {
          failed += 1;
        } else {
          created += 1;
        }
      }
    }

    return {
      success: failed < payload.assessments.length,
      message:
        failed > 0
          ? `Saved ${created + updated} assessments with ${failed} failure(s).`
          : `Saved ${created + updated} assessments successfully.`,
      created,
      updated,
      failed,
    };
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : "Failed to save assessments.",
      created: 0,
      updated: 0,
      failed: payload.assessments.length,
    };
  }
}

export async function getStudentAssessmentsByLearningArea(
  studentId: string,
  learningAreaId: string,
  termId: string,
  academicYearId: string,
  currentUser: AuthUser,
): Promise<Assessment[]> {
  const schoolId = getSchoolId(currentUser);
  const supabase = await createSupabaseServerClient();

  const { data, error } = await supabase
    .from("assessments")
    .select(
      `
      assessment_id,
      school_id,
      student_id,
      competency_id,
      learning_area_id,
      class_id,
      academic_year_id,
      term_id,
      score,
      level_id,
      remarks,
      assessment_date,
      assessed_by,
      created_at,
      updated_at,
      competencies(name),
      learning_areas(name),
      terms(name),
      performance_levels(name, label)
    `,
    )
    .eq("school_id", schoolId)
    .eq("student_id", studentId)
    .eq("learning_area_id", learningAreaId)
    .eq("term_id", termId)
    .eq("academic_year_id", academicYearId)
    .order("assessment_date", { ascending: false });

  if (error) {
    throw new Error(`Failed to get student assessments: ${error.message}`);
  }

  return (data ?? []).map(normalizeAssessmentRow);
}

export async function deleteAssessment(
  id: string,
  currentUser: AuthUser,
): Promise<{ success: boolean; message: string }> {
  try {
    const schoolId = getSchoolId(currentUser);
    const supabase = await createSupabaseServerClient();

    const { data: existing } = await supabase
      .from("assessments")
      .select("assessment_id, class_id, learning_area_id, academic_year_id, term_id")
      .eq("assessment_id", id)
      .eq("school_id", schoolId)
      .maybeSingle();

    if (!existing) {
      return { success: false, message: "Assessment not found." };
    }

    await ensureTeacherAssignment(
      schoolId,
      existing.class_id,
      existing.learning_area_id,
      existing.academic_year_id,
      existing.term_id,
      currentUser,
    );

    const { error } = await supabase
      .from("assessments")
      .delete()
      .eq("assessment_id", id)
      .eq("school_id", schoolId);

    if (error) {
      return { success: false, message: `Failed to delete assessment: ${error.message}` };
    }

    return { success: true, message: "Assessment deleted successfully." };
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : "Failed to delete assessment.",
    };
  }
}

export const dummyAssessmentService = {};
export const getStudentAssessmentsByYear = async (): Promise<Assessment[]> => [];
