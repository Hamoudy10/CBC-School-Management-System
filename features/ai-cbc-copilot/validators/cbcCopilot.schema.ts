import { z } from "zod";

const uuidField = z.string().uuid("Invalid ID format");

export const lessonPlanRequestSchema = z.object({
  classId: uuidField,
  learningAreaId: uuidField,
  strandId: uuidField,
  subStrandId: uuidField,
  durationMinutes: z.coerce.number().int().min(10).max(180),
  additionalInstructions: z.string().trim().max(1000).optional(),
});

export const assessmentGeneratorRequestSchema = z.object({
  classId: uuidField,
  learningAreaId: uuidField,
  strandId: uuidField,
  subStrandId: uuidField,
  assessmentType: z.enum(["quiz", "test"]),
  questionCount: z.coerce.number().int().min(3).max(30).default(10),
  additionalInstructions: z.string().trim().max(1000).optional(),
});

export const explanationModeRequestSchema = z.object({
  classId: uuidField,
  learningAreaId: uuidField.optional(),
  strandId: uuidField.optional(),
  subStrandId: uuidField.optional(),
  competencyId: uuidField.optional(),
  question: z.string().trim().min(10).max(1500),
});

export type LessonPlanRequestInput = z.infer<typeof lessonPlanRequestSchema>;
export type AssessmentGeneratorRequestInput = z.infer<
  typeof assessmentGeneratorRequestSchema
>;
export type ExplanationModeRequestInput = z.infer<
  typeof explanationModeRequestSchema
>;
