import { z } from 'zod';

export const analyzeFeeRiskSchema = z.object({
  studentId: z.string().uuid().optional(),
  classId: z.string().uuid().optional(),
  academicYearId: z.string().uuid().optional(),
  termId: z.string().uuid().optional(),
});

export type AnalyzeFeeRiskInput = z.infer<typeof analyzeFeeRiskSchema>;
