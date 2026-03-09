// features/academics/types.ts
// ============================================================
// Type definitions for CBC Curriculum & Subjects module
// Covers: learning areas, strands, sub-strands, competencies,
//         student-subject mapping, teacher-subject mapping
// ============================================================

// ============================================================
// Learning Area (CBC Subject)
// ============================================================
export interface LearningArea {
  learningAreaId: string;
  schoolId: string;
  name: string;
  description: string | null;
  isCore: boolean;
  applicableGrades: string[];
  createdAt: string;
  updatedAt: string;
}

export interface CreateLearningAreaPayload {
  name: string;
  description?: string;
  isCore?: boolean;
  applicableGrades?: string[];
}

export interface UpdateLearningAreaPayload {
  name?: string;
  description?: string;
  isCore?: boolean;
  applicableGrades?: string[];
}

// ============================================================
// Strand
// ============================================================
export interface Strand {
  strandId: string;
  schoolId: string;
  learningAreaId: string;
  learningAreaName?: string;
  name: string;
  description: string | null;
  sortOrder: number;
  createdAt: string;
}

export interface CreateStrandPayload {
  learningAreaId: string;
  name: string;
  description?: string;
  sortOrder?: number;
}

export interface UpdateStrandPayload {
  name?: string;
  description?: string;
  sortOrder?: number;
}

// ============================================================
// Sub-Strand
// ============================================================
export interface SubStrand {
  subStrandId: string;
  schoolId: string;
  strandId: string;
  strandName?: string;
  name: string;
  description: string | null;
  sortOrder: number;
  createdAt: string;
}

export interface CreateSubStrandPayload {
  strandId: string;
  name: string;
  description?: string;
  sortOrder?: number;
}

export interface UpdateSubStrandPayload {
  name?: string;
  description?: string;
  sortOrder?: number;
}

// ============================================================
// Competency
// ============================================================
export interface Competency {
  competencyId: string;
  schoolId: string;
  subStrandId: string;
  subStrandName?: string;
  name: string;
  description: string | null;
  sortOrder: number;
  createdAt: string;
}

export interface CreateCompetencyPayload {
  subStrandId: string;
  name: string;
  description?: string;
  sortOrder?: number;
}

export interface UpdateCompetencyPayload {
  name?: string;
  description?: string;
  sortOrder?: number;
}

// ============================================================
// Teacher-Subject (Learning Area) Assignment
// ============================================================
export interface TeacherSubjectAssignment {
  id: string;
  schoolId: string;
  teacherId: string;
  teacherName?: string;
  learningAreaId: string;
  learningAreaName?: string;
  classId: string;
  className?: string;
  academicYearId: string;
  termId: string;
  termName?: string;
  isActive: boolean;
  createdAt: string;
}

export interface CreateTeacherSubjectPayload {
  teacherId: string;
  learningAreaId: string;
  classId: string;
  academicYearId: string;
  termId: string;
}

// ============================================================
// Full CBC Hierarchy (for tree view / report generation)
// ============================================================
export interface CBCHierarchy {
  learningArea: LearningArea;
  strands: {
    strand: Strand;
    subStrands: {
      subStrand: SubStrand;
      competencies: Competency[];
    }[];
  }[];
}

// ============================================================
// List Filters
// ============================================================
export interface LearningAreaFilters {
  search?: string;
  isCore?: boolean;
  gradeId?: string;
  page?: number;
  pageSize?: number;
}

export interface TeacherSubjectFilters {
  teacherId?: string;
  classId?: string;
  learningAreaId?: string;
  academicYearId?: string;
  termId?: string;
  isActive?: boolean;
  page?: number;
  pageSize?: number;
}
