// features/academics/validators/academic.schema.ts
// ============================================================
// Zod validation schemas for CBC Curriculum module
// All inputs validated BEFORE database operations
// ============================================================

import { z } from "zod";

const uuidField = z.string().uuid("Invalid ID format");

const nameField = z
  .string()
  .min(1, "Name is required")
  .max(200, "Name must be under 200 characters")
  .transform((v) => v.trim());

const descriptionField = z
  .string()
  .max(2000, "Description must be under 2000 characters")
  .optional()
  .or(z.literal(""));

const sortOrderField = z.coerce
  .number()
  .int("Sort order must be a whole number")
  .min(0, "Sort order cannot be negative")
  .default(0);

// ============================================================
// Learning Area Schemas
// ============================================================
export const createLearningAreaSchema = z.object({
  name: nameField,
  description: descriptionField,
  isCore: z.boolean().default(true),
  applicableGrades: z.array(uuidField).default([]),
});

export type CreateLearningAreaInput = z.infer<typeof createLearningAreaSchema>;

export const updateLearningAreaSchema = z
  .object({
    name: nameField.optional(),
    description: descriptionField,
    isCore: z.boolean().optional(),
    applicableGrades: z.array(uuidField).optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field must be provided",
  });

export type UpdateLearningAreaInput = z.infer<typeof updateLearningAreaSchema>;

// ============================================================
// Strand Schemas
// ============================================================
export const createStrandSchema = z.object({
  learningAreaId: uuidField,
  name: nameField,
  description: descriptionField,
  sortOrder: sortOrderField,
});

export type CreateStrandInput = z.infer<typeof createStrandSchema>;

export const updateStrandSchema = z
  .object({
    name: nameField.optional(),
    description: descriptionField,
    sortOrder: sortOrderField.optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field must be provided",
  });

export type UpdateStrandInput = z.infer<typeof updateStrandSchema>;

// ============================================================
// Sub-Strand Schemas
// ============================================================
export const createSubStrandSchema = z.object({
  strandId: uuidField,
  name: nameField,
  description: descriptionField,
  sortOrder: sortOrderField,
});

export type CreateSubStrandInput = z.infer<typeof createSubStrandSchema>;

export const updateSubStrandSchema = z
  .object({
    name: nameField.optional(),
    description: descriptionField,
    sortOrder: sortOrderField.optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field must be provided",
  });

export type UpdateSubStrandInput = z.infer<typeof updateSubStrandSchema>;

// ============================================================
// Competency Schemas
// ============================================================
export const createCompetencySchema = z.object({
  subStrandId: uuidField,
  name: z
    .string()
    .min(1, "Competency name is required")
    .max(255, "Name must be under 255 characters")
    .transform((v) => v.trim()),
  description: descriptionField,
  sortOrder: sortOrderField,
});

export type CreateCompetencyInput = z.infer<typeof createCompetencySchema>;

export const updateCompetencySchema = z
  .object({
    name: z
      .string()
      .min(1)
      .max(255)
      .transform((v) => v.trim())
      .optional(),
    description: descriptionField,
    sortOrder: sortOrderField.optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field must be provided",
  });

export type UpdateCompetencyInput = z.infer<typeof updateCompetencySchema>;

// ============================================================
// Teacher-Subject Assignment Schema
// ============================================================
export const createTeacherSubjectSchema = z.object({
  teacherId: uuidField,
  learningAreaId: uuidField,
  classId: uuidField,
  academicYearId: uuidField,
  termId: uuidField,
});

export type CreateTeacherSubjectInput = z.infer<
  typeof createTeacherSubjectSchema
>;

// ============================================================
// Filter Schemas
// ============================================================
export const learningAreaFiltersSchema = z.object({
  search: z.string().max(100).optional(),
  isCore: z
    .string()
    .transform((v) => v === "true")
    .optional(),
  gradeId: uuidField.optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(50),
});

export type LearningAreaFiltersInput = z.infer<
  typeof learningAreaFiltersSchema
>;

export const teacherSubjectFiltersSchema = z.object({
  teacherId: uuidField.optional(),
  classId: uuidField.optional(),
  learningAreaId: uuidField.optional(),
  academicYearId: uuidField.optional(),
  termId: uuidField.optional(),
  isActive: z
    .string()
    .transform((v) => v === "true")
    .optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(50),
});

export type TeacherSubjectFiltersInput = z.infer<
  typeof teacherSubjectFiltersSchema
>;
