import { z } from "zod";

const uuidField = z.string().uuid("Invalid ID format");

export const classStudentsQuerySchema = z.object({
  classId: uuidField,
});

export const reportCommentRequestSchema = z.object({
  classId: uuidField,
  studentId: uuidField,
  learningAreaId: uuidField.optional(),
  termId: uuidField.optional(),
  academicYearId: uuidField.optional(),
});

export const markEntryAssistantRequestSchema = z.object({
  classId: uuidField,
  studentId: uuidField.optional(),
  learningAreaId: uuidField.optional(),
  rawMark: z.coerce.number().min(0).max(100),
  maxMark: z.coerce.number().min(1).max(100).default(100),
});

export const classroomInsightsRequestSchema = z.object({
  classId: uuidField,
  learningAreaId: uuidField.optional(),
  termId: uuidField.optional(),
  academicYearId: uuidField.optional(),
  lookbackDays: z.coerce.number().int().min(7).max(120).default(30),
});

export type ClassStudentsQueryInput = z.infer<typeof classStudentsQuerySchema>;
export type ReportCommentRequestInput = z.infer<typeof reportCommentRequestSchema>;
export type MarkEntryAssistantRequestInput = z.infer<
  typeof markEntryAssistantRequestSchema
>;
export type ClassroomInsightsRequestInput = z.infer<
  typeof classroomInsightsRequestSchema
>;
