// features/assessments/validators/assessment.schema.ts
// ============================================================
// Zod validation schemas for Assessment & Reporting module
// All inputs validated BEFORE database operations
// Score validation: 1-4 (CBC scale)
// ============================================================

import { z } from "zod";

const uuidField = z.string().uuid("Invalid ID format");

// CBC Score: 1 = Below Expectation, 2 = Approaching, 3 = Meeting, 4 = Exceeding
const scoreField = z.coerce
  .number()
  .int("Score must be a whole number")
  .min(1, "Score must be at least 1")
  .max(4, "Score cannot exceed 4");

const remarksField = z
  .string()
  .max(1000, "Remarks must be under 1000 characters")
  .optional()
  .or(z.literal(""));

const dateField = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be in YYYY-MM-DD format");

const performanceLabelField = z.enum([
  "below_expectation",
  "approaching",
  "meeting",
  "exceeding",
]);

const assessmentTypeField = z.enum([
  "observation",
  "test",
  "project",
  "practical",
  "other",
]);

const reportTypeField = z.enum(["term", "yearly"]);

// ============================================================
// Performance Level Schemas
// ============================================================
export const createPerformanceLevelSchema = z.object({
  name: z
    .string()
    .min(1, "Name is required")
    .max(50, "Name must be under 50 characters"),
  label: performanceLabelField,
  numericValue: z.coerce
    .number()
    .int()
    .min(1, "Value must be at least 1")
    .max(4, "Value cannot exceed 4"),
  description: z.string().max(500).optional(),
});

export type CreatePerformanceLevelInput = z.infer<
  typeof createPerformanceLevelSchema
>;

// ============================================================
// Assessment Template Schemas
// ============================================================
export const createAssessmentTemplateSchema = z.object({
  competencyId: uuidField,
  name: z
    .string()
    .min(1, "Name is required")
    .max(200, "Name must be under 200 characters"),
  description: z.string().max(1000).optional(),
  maxScore: z.coerce.number().int().min(1).max(100).default(4),
  assessmentType: assessmentTypeField.default("observation"),
});

export type CreateAssessmentTemplateInput = z.infer<
  typeof createAssessmentTemplateSchema
>;

export const updateAssessmentTemplateSchema = z
  .object({
    name: z.string().min(1).max(200).optional(),
    description: z.string().max(1000).optional(),
    maxScore: z.coerce.number().int().min(1).max(100).optional(),
    assessmentType: assessmentTypeField.optional(),
    isActive: z.boolean().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field must be provided",
  });

export type UpdateAssessmentTemplateInput = z.infer<
  typeof updateAssessmentTemplateSchema
>;

// ============================================================
// Individual Assessment Schemas
// ============================================================
export const createAssessmentSchema = z.object({
  studentId: uuidField,
  competencyId: uuidField,
  learningAreaId: uuidField,
  classId: uuidField,
  academicYearId: uuidField,
  termId: uuidField,
  score: scoreField,
  remarks: remarksField,
  assessmentDate: dateField.optional(),
});

export type CreateAssessmentInput = z.infer<typeof createAssessmentSchema>;

export const updateAssessmentSchema = z
  .object({
    score: scoreField.optional(),
    remarks: remarksField,
    assessmentDate: dateField.optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field must be provided",
  });

export type UpdateAssessmentInput = z.infer<typeof updateAssessmentSchema>;

// ============================================================
// Bulk Assessment Schema (for class-wide entry)
// ============================================================
export const bulkAssessmentSchema = z.object({
  classId: uuidField,
  competencyId: uuidField,
  learningAreaId: uuidField,
  academicYearId: uuidField,
  termId: uuidField,
  assessments: z
    .array(
      z.object({
        studentId: uuidField,
        score: scoreField,
        remarks: remarksField,
      }),
    )
    .min(1, "At least one assessment is required")
    .max(100, "Cannot submit more than 100 assessments at once"),
});

export type BulkAssessmentInput = z.infer<typeof bulkAssessmentSchema>;

// ============================================================
// Report Card Generation Schema
// ============================================================
export const generateReportCardSchema = z.object({
  studentId: uuidField,
  classId: uuidField,
  academicYearId: uuidField,
  termId: uuidField,
  reportType: reportTypeField,
  classTeacherRemarks: z.string().max(2000).optional(),
  principalRemarks: z.string().max(2000).optional(),
});

export type GenerateReportCardInput = z.infer<typeof generateReportCardSchema>;

export const publishReportCardsSchema = z.object({
  classId: uuidField,
  academicYearId: uuidField,
  termId: uuidField,
  reportType: reportTypeField,
});

export type PublishReportCardsInput = z.infer<typeof publishReportCardsSchema>;

export const updateReportCardRemarksSchema = z.object({
  classTeacherRemarks: z.string().max(2000).optional(),
  principalRemarks: z.string().max(2000).optional(),
});

export type UpdateReportCardRemarksInput = z.infer<
  typeof updateReportCardRemarksSchema
>;

// ============================================================
// Filter Schemas
// ============================================================
export const assessmentFiltersSchema = z.object({
  studentId: uuidField.optional(),
  classId: uuidField.optional(),
  learningAreaId: uuidField.optional(),
  competencyId: uuidField.optional(),
  academicYearId: uuidField.optional(),
  termId: uuidField.optional(),
  assessedBy: uuidField.optional(),
  startDate: dateField.optional(),
  endDate: dateField.optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(50),
});

export type AssessmentFiltersInput = z.infer<typeof assessmentFiltersSchema>;

export const reportCardFiltersSchema = z.object({
  studentId: uuidField.optional(),
  classId: uuidField.optional(),
  academicYearId: uuidField.optional(),
  termId: uuidField.optional(),
  reportType: reportTypeField.optional(),
  isPublished: z
    .string()
    .transform((v) => v === "true")
    .optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(50),
});

export type ReportCardFiltersInput = z.infer<typeof reportCardFiltersSchema>;

export const analyticsFiltersSchema = z.object({
  classId: uuidField.optional(),
  learningAreaId: uuidField.optional(),
  academicYearId: uuidField,
  termId: uuidField,
});

export type AnalyticsFiltersInput = z.infer<typeof analyticsFiltersSchema>;
