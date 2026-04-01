// features/special-needs/validators/special-needs.schema.ts
// ============================================================
// Zod validation schemas for Special Needs module
// ============================================================

import { z } from "zod";

const uuidField = z.string().uuid("Invalid ID format");

const needsTypeField = z.enum([
  "learning_disability",
  "physical_disability",
  "visual_impairment",
  "hearing_impairment",
  "speech_impairment",
  "autism_spectrum",
  "adhd",
  "dyslexia",
  "dyscalculia",
  "emotional_behavioral",
  "gifted_talented",
  "medical_condition",
  "other",
]);

const assessmentAdjustmentSchema = z.object({
  competencyId: z.string().uuid().optional(),
  learningAreaId: z.string().uuid().optional(),
  adjustmentType: z.string().min(1).max(100),
  description: z.string().max(500),
});

export const createSpecialNeedSchema = z.object({
  studentId: uuidField,
  needsType: needsTypeField,
  description: z.string().max(2000).optional(),
  accommodations: z.string().max(2000).optional(),
  assessmentAdjustments: z.array(assessmentAdjustmentSchema).optional(),
});

export type CreateSpecialNeedInput = z.infer<typeof createSpecialNeedSchema>;

export const updateSpecialNeedSchema = z
  .object({
    needsType: needsTypeField.optional(),
    description: z.string().max(2000).optional(),
    accommodations: z.string().max(2000).optional(),
    assessmentAdjustments: z.array(assessmentAdjustmentSchema).optional(),
    isActive: z.boolean().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field must be provided",
  });

export type UpdateSpecialNeedInput = z.infer<typeof updateSpecialNeedSchema>;

export const specialNeedFiltersSchema = z.object({
  studentId: uuidField.optional(),
  needsType: needsTypeField.optional(),
  isActive: z
    .string()
    .transform((v) => v === "true")
    .optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(50),
});

export type SpecialNeedFiltersInput = z.infer<typeof specialNeedFiltersSchema>;
