// features/special-needs/types.ts
// ============================================================
// Type definitions for Special Needs module
// ============================================================

export type NeedsType =
  | "learning_disability"
  | "physical_disability"
  | "visual_impairment"
  | "hearing_impairment"
  | "speech_impairment"
  | "autism_spectrum"
  | "adhd"
  | "dyslexia"
  | "dyscalculia"
  | "emotional_behavioral"
  | "gifted_talented"
  | "medical_condition"
  | "other";

export const NEEDS_TYPE_LABELS: Record<NeedsType, string> = {
  learning_disability: "Learning Disability",
  physical_disability: "Physical Disability",
  visual_impairment: "Visual Impairment",
  hearing_impairment: "Hearing Impairment",
  speech_impairment: "Speech Impairment",
  autism_spectrum: "Autism Spectrum",
  adhd: "ADHD",
  dyslexia: "Dyslexia",
  dyscalculia: "Dyscalculia",
  emotional_behavioral: "Emotional/Behavioral",
  gifted_talented: "Gifted/Talented",
  medical_condition: "Medical Condition",
  other: "Other",
};

export interface AssessmentAdjustment {
  competencyId?: string;
  learningAreaId?: string;
  adjustmentType: string;
  description: string;
}

export interface SpecialNeed {
  specialNeedsId: string;
  schoolId: string;
  studentId: string;
  studentName?: string;
  studentAdmissionNo?: string;
  className?: string;
  needsType: NeedsType;
  needsTypeLabel: string;
  description: string | null;
  accommodations: string | null;
  assessmentAdjustments: AssessmentAdjustment[] | null;
  isActive: boolean;
  createdBy: string | null;
  createdByName?: string;
  createdAt: string;
  updatedAt: string;
}

export interface SpecialNeedFilters {
  studentId?: string;
  needsType?: NeedsType;
  isActive?: boolean;
  page?: number;
  pageSize?: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}
