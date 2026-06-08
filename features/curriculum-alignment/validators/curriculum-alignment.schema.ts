import { z } from 'zod';

export const checkAlignmentSchema = z.object({
  lessonPlan: z.object({
    title: z.string().min(1).max(200),
    subject: z.string().min(1).max(100),
    grade: z.string().min(1).max(20),
    duration: z.string().min(1).max(50),
    objectives: z.array(z.string().min(1)).min(1),
    activities: z.array(z.string().min(1)).min(1),
    assessmentMethods: z.array(z.string().min(1)).min(1),
    materials: z.array(z.string()).optional(),
  }),
  learningAreaId: z.string().uuid().optional(),
  strandId: z.string().uuid().optional(),
});

export type CheckAlignmentInput = z.infer<typeof checkAlignmentSchema>;
