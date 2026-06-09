import { z } from 'zod';

export const generateExamSchema = z.object({
  subject: z.string().min(1).max(100),
  grade: z.string().min(1).max(50),
  strand: z.string().optional(),
  subStrand: z.string().optional(),
  durationMinutes: z.number().int().min(10).max(180).default(60),
  totalMarks: z.number().int().min(5).max(100).default(30),
  questionTypes: z.array(z.enum(['multiple_choice', 'short_answer', 'structured', 'essay'])).min(1).default(['multiple_choice', 'short_answer', 'structured']),
  difficultyDistribution: z.object({
    easy: z.number().int().min(0).max(100).default(30),
    medium: z.number().int().min(0).max(100).default(50),
    hard: z.number().int().min(0).max(100).default(20),
  }).default({ easy: 30, medium: 50, hard: 20 }),
  includeMarkingScheme: z.boolean().default(true),
  learningAreaId: z.string().uuid().optional(),
});

export type GenerateExamInput = z.infer<typeof generateExamSchema>;
