import type { AuthUser } from '@/types/auth';

const TEACHER_ROLES = new Set(['teacher', 'class_teacher', 'subject_teacher']);

export const EXAM_SELECT = `
  exam_id,
  school_id,
  learning_area_id,
  title,
  description,
  content,
  exam_type,
  file_url,
  file_name,
  file_type,
  term_id,
  academic_year_id,
  created_by,
  created_at,
  updated_at,
  learning_areas ( name ),
  terms ( name ),
  academic_years ( year )
`;

export const EXAM_SET_SELECT = `
  exam_set_id,
  school_id,
  exam_id,
  class_id,
  term_id,
  academic_year_id,
  exam_date,
  notes,
  created_by,
  created_at,
  updated_at,
  exam:exam_bank (
    exam_id,
    title,
    exam_type,
    learning_area_id,
    learning_areas ( name )
  ),
  class:classes (
    class_id,
    name
  ),
  term:terms (
    term_id,
    name
  ),
  year:academic_years (
    academic_year_id,
    year
  )
`;

export function isTeacherScopedRole(role: string) {
  return TEACHER_ROLES.has(role);
}

export function normalizeExamRow(row: any) {
  return {
    examId: row.exam_id,
    schoolId: row.school_id,
    learningAreaId: row.learning_area_id,
    title: row.title,
    description: row.description,
    content: row.content,
    type: row.exam_type,
    fileUrl: row.file_url,
    fileName: row.file_name,
    fileType: row.file_type,
    termId: row.term_id,
    academicYearId: row.academic_year_id,
    learningAreaName: row.learning_areas?.name ?? null,
    termName: row.terms?.name ?? null,
    academicYearName: row.academic_years?.year ?? null,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function normalizeExamSetRow(row: any) {
  return {
    examSetId: row.exam_set_id,
    schoolId: row.school_id,
    examId: row.exam_id,
    classId: row.class_id,
    termId: row.term_id,
    academicYearId: row.academic_year_id,
    examDate: row.exam_date,
    notes: row.notes,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    exam: row.exam,
    class: row.class,
    term: row.term,
    year: row.year,
    examTitle: row.exam?.title ?? null,
    examType: row.exam?.exam_type ?? null,
    learningAreaId: row.exam?.learning_area_id ?? null,
    learningAreaName: row.exam?.learning_areas?.name ?? null,
    className: row.class?.name ?? null,
    termName: row.term?.name ?? null,
    academicYearName: row.year?.year ?? null,
  };
}

export async function resolveAcademicContext(
  supabase: any,
  schoolId: string,
  input: {
    termId?: string | null;
    academicYearId?: string | null;
    requireTerm?: boolean;
    requireAcademicYear?: boolean;
  },
) {
  let termId = input.termId ?? null;
  let academicYearId = input.academicYearId ?? null;

  if (academicYearId) {
    const { data: year, error } = await supabase
      .from('academic_years')
      .select('academic_year_id')
      .eq('academic_year_id', academicYearId)
      .eq('school_id', schoolId)
      .maybeSingle();

    if (error) {
      throw new Error(`Failed to validate academic year: ${error.message}`);
    }

    if (!year) {
      throw new Error('Academic year not found.');
    }
  } else if (input.requireAcademicYear) {
    const { data: activeYear, error } = await supabase
      .from('academic_years')
      .select('academic_year_id')
      .eq('school_id', schoolId)
      .eq('is_active', true)
      .maybeSingle();

    if (error) {
      throw new Error(`Failed to resolve academic year: ${error.message}`);
    }

    academicYearId = activeYear?.academic_year_id ?? null;
  }

  if (termId) {
    const { data: term, error } = await supabase
      .from('terms')
      .select('term_id, academic_year_id')
      .eq('term_id', termId)
      .eq('school_id', schoolId)
      .maybeSingle();

    if (error) {
      throw new Error(`Failed to validate term: ${error.message}`);
    }

    if (!term) {
      throw new Error('Term not found.');
    }

    if (academicYearId && term.academic_year_id !== academicYearId) {
      throw new Error('Selected term does not match the academic year.');
    }

    academicYearId = academicYearId ?? term.academic_year_id;
  } else if (input.requireTerm) {
    let termQuery = supabase
      .from('terms')
      .select('term_id, academic_year_id')
      .eq('school_id', schoolId)
      .eq('is_active', true)
      .order('start_date', { ascending: false })
      .limit(1);

    if (academicYearId) {
      termQuery = termQuery.eq('academic_year_id', academicYearId);
    }

    const { data: activeTerm, error } = await termQuery.maybeSingle();

    if (error) {
      throw new Error(`Failed to resolve term: ${error.message}`);
    }

    termId = activeTerm?.term_id ?? null;
    academicYearId = academicYearId ?? activeTerm?.academic_year_id ?? null;
  }

  if (input.requireAcademicYear && !academicYearId) {
    throw new Error('An active academic year is required for this action.');
  }

  if (input.requireTerm && !termId) {
    throw new Error('An active term is required for this action.');
  }

  return { termId, academicYearId };
}

export async function ensureTeacherCanEditExam(user: AuthUser, createdBy: string | null) {
  if (!isTeacherScopedRole(user.role)) {
    return;
  }

  if (!createdBy || createdBy !== user.id) {
    throw new Error('You can only update exam bank entries you created.');
  }
}

export async function ensureTeacherAssignmentForSchedule(
  supabase: any,
  user: AuthUser,
  input: {
    classId: string;
    learningAreaId: string;
    academicYearId: string;
    termId: string;
  },
) {
  if (!isTeacherScopedRole(user.role)) {
    return;
  }

  if (!user.schoolId) {
    throw new Error('School context required.');
  }

  const { data: staff, error: staffError } = await supabase
    .from('staff')
    .select('staff_id')
    .eq('user_id', user.id)
    .eq('school_id', user.schoolId)
    .eq('status', 'active')
    .maybeSingle();

  if (staffError) {
    throw new Error(`Failed to verify teacher profile: ${staffError.message}`);
  }

  if (!staff?.staff_id) {
    throw new Error('Teacher profile not found for the current user.');
  }

  const { data: assignment, error: assignmentError } = await supabase
    .from('teacher_subjects')
    .select('id')
    .eq('school_id', user.schoolId)
    .eq('teacher_id', staff.staff_id)
    .eq('class_id', input.classId)
    .eq('learning_area_id', input.learningAreaId)
    .eq('academic_year_id', input.academicYearId)
    .eq('term_id', input.termId)
    .eq('is_active', true)
    .maybeSingle();

  if (assignmentError) {
    throw new Error(`Failed to verify teacher assignment: ${assignmentError.message}`);
  }

  if (!assignment) {
    throw new Error(
      'You are not assigned to this class and learning area for the selected term.',
    );
  }
}
