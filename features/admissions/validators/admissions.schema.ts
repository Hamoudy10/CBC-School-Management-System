import { z } from 'zod';

export const submitApplicationSchema = z.object({
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),
  dateOfBirth: z.string(),
  gender: z.enum(['male', 'female']),
  gradeApplyingFor: z.string().min(1).max(50),
  previousSchool: z.string().max(200).optional(),
  parentName: z.string().min(1).max(200),
  parentPhone: z.string().min(1).max(20),
  parentEmail: z.string().email().max(200).optional().or(z.literal('')),
  parentIdNumber: z.string().max(20).optional(),
});

export const reviewApplicationSchema = z.object({
  status: z.enum(['reviewed', 'accepted', 'rejected']),
  notes: z.string().max(1000).optional(),
});

export type SubmitApplicationInput = z.infer<typeof submitApplicationSchema>;
