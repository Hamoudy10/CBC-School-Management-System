import { z } from "zod";

const uuidField = z.string().uuid("Invalid UUID format");

export const performanceForecastRequestSchema = z.object({
  classId: uuidField,
  termId: uuidField.optional(),
  academicYearId: uuidField.optional(),
  learningAreaIds: z.array(uuidField).optional(),
});

export const subjectRecommendationRequestSchema = z.object({
  studentId: uuidField,
  classId: uuidField.optional(),
  includeCareerPaths: z.boolean().default(true),
});

export const studentClusterRequestSchema = z.object({
  classId: uuidField,
  termId: uuidField.optional(),
  academicYearId: uuidField.optional(),
  clusterCount: z.coerce.number().int().min(2).max(6).default(4),
});

export const interventionRecommendationRequestSchema = z.object({
  classId: uuidField,
  termId: uuidField.optional(),
  academicYearId: uuidField.optional(),
  minRiskLevel: z.enum(["low", "medium", "high"]).default("medium"),
});

export type PerformanceForecastRequest = z.infer<typeof performanceForecastRequestSchema>;
export type SubjectRecommendationRequest = z.infer<typeof subjectRecommendationRequestSchema>;
export type StudentClusterRequest = z.infer<typeof studentClusterRequestSchema>;
export type InterventionRecommendationRequest = z.infer<typeof interventionRecommendationRequestSchema>;
