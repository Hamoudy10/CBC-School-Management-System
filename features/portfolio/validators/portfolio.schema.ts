import { z } from 'zod';

export const submitEntrySchema = z.object({
  studentId: z.string().uuid(),
  learningAreaId: z.string().uuid(),
  strandId: z.string().uuid().optional(),
  title: z.string().min(1).max(200),
  description: z.string().max(1000).optional(),
  evidenceType: z.enum(['document', 'image', 'video', 'link', 'text']),
  evidenceUrl: z.string().max(500).optional(),
  evidenceContent: z.string().max(5000).optional(),
});

export const assessEntrySchema = z.object({
  score: z.number().int().min(1).max(4),
  level: z.enum(['exceeding', 'meeting', 'approaching', 'below_expectation']),
  comment: z.string().max(1000).optional(),
  status: z.enum(['assessed', 'returned']),
});

export type SubmitEntryInput = z.infer<typeof submitEntrySchema>;
export type AssessEntryInput = z.infer<typeof assessEntrySchema>;
