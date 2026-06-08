import { z } from 'zod';

export const optimizeTimetableSchema = z.object({
  classIds: z.array(z.string().uuid()).min(1),
  termId: z.string().uuid(),
  academicYearId: z.string().uuid(),
  preferences: z.object({
    teacherMaxPeriodsPerDay: z.number().int().min(1).max(10).default(6),
    maxConsecutivePeriods: z.number().int().min(1).max(5).default(3),
    preferMorningCore: z.boolean().default(true),
    includeBreaks: z.boolean().default(true),
  }).optional(),
});

export type OptimizeTimetableInput = z.infer<typeof optimizeTimetableSchema>;
