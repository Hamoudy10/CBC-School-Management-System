import { z } from 'zod';

export const createExamRoomSchema = z.object({
  name: z.string().min(1).max(100),
  capacity: z.number().int().min(1).max(200),
  building: z.string().max(100).optional(),
  floor: z.string().max(50).optional(),
});

export const updateExamRoomSchema = createExamRoomSchema.partial();

export const generateSeatingPlanSchema = z.object({
  examSetId: z.string().uuid(),
  roomIds: z.array(z.string().uuid()).min(1),
  seatsPerRow: z.number().int().min(2).max(10).default(4),
  shuffleStudents: z.boolean().default(true),
});

export type CreateExamRoomInput = z.infer<typeof createExamRoomSchema>;
export type GenerateSeatingPlanInput = z.infer<typeof generateSeatingPlanSchema>;
