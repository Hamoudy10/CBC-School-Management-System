import { z } from 'zod';

export const generateWorksheetSchema = z.object({
  studentId: z.string().uuid(),
  subjectId: z.string().uuid().optional(),
  strandId: z.string().uuid().optional(),
  difficulty: z.enum(['easy', 'medium', 'hard', 'auto']).default('auto'),
  questionCount: z.number().int().min(3).max(20).default(10),
});

export type GenerateWorksheetInput = z.infer<typeof generateWorksheetSchema>;
