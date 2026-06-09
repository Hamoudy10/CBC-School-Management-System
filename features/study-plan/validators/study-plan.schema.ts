import { z } from 'zod';

export const generateStudyPlanSchema = z.object({
  classId: z.string().uuid(),
  studentId: z.string().uuid().optional(),
  targetExam: z.string().min(1).max(200),
  startDate: z.string(),
  endDate: z.string(),
  subjects: z.array(z.string()).min(1).optional(),
  hoursPerDay: z.number().int().min(1).max(12).default(3),
});

export type GenerateStudyPlanInput = z.infer<typeof generateStudyPlanSchema>;
