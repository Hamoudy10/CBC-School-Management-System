import { z } from 'zod';

export const recordAssessmentSchema = z.object({
  transcribedText: z.string().min(3).max(5000),
  studentId: z.string().uuid().optional(),
  competencyId: z.string().uuid().optional(),
  classId: z.string().uuid().optional(),
});

export type RecordAssessmentInput = z.infer<typeof recordAssessmentSchema>;
