import { z } from 'zod';

export const smartSearchSchema = z.object({
  query: z.string().min(3).max(500),
  scope: z.enum(['students', 'assessments', 'attendance', 'fees', 'all']).default('all'),
});

export type SmartSearchInput = z.infer<typeof smartSearchSchema>;
