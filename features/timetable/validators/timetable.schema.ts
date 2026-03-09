// features/timetable/validators/timetable.schema.ts
import { z } from 'zod';

export const createTimetableSlotSchema = z.object({
  classId: z.string().optional(),
  teacherId: z.string().optional(),
  dayOfWeek: z.string().optional(),
  learningAreaId: z.string().optional(),
  startTime: z.string().optional(),
  endTime: z.string().optional(),
  room: z.string().optional(),
});

export const updateTimetableSlotSchema = z.object({
  slot_id: z.string(),
  teacherId: z.string().optional(),
  room: z.string().optional(),
  isActive: z.boolean().optional(),
});
