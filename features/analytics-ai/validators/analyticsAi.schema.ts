import { z } from "zod";

const uuidField = z.string().uuid("Invalid ID format");

export const dropoutRiskRequestSchema = z.object({
  classId: uuidField,
  lookbackDays: z.coerce.number().int().min(14).max(180).default(60),
  maxStudents: z.coerce.number().int().min(5).max(50).default(25),
  termId: uuidField.optional(),
  academicYearId: uuidField.optional(),
});

export const classPerformanceRequestSchema = z.object({
  classId: uuidField,
  learningAreaId: uuidField.optional(),
  lookbackDays: z.coerce.number().int().min(14).max(180).default(90),
  termId: uuidField.optional(),
  academicYearId: uuidField.optional(),
});

export const schoolHealthRequestSchema = z.object({
  lookbackDays: z.coerce.number().int().min(30).max(365).default(120),
  minAssessments: z.coerce.number().int().min(5).max(100).default(12),
  termId: uuidField.optional(),
  academicYearId: uuidField.optional(),
});

export type DropoutRiskRequestInput = z.infer<typeof dropoutRiskRequestSchema>;
export type ClassPerformanceRequestInput = z.infer<typeof classPerformanceRequestSchema>;
export type SchoolHealthRequestInput = z.infer<typeof schoolHealthRequestSchema>;
