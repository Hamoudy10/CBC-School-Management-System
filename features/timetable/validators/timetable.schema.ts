// features/timetable/validators/timetable.schema.ts
import { z } from 'zod';

const timeField = z
  .string()
  .regex(/^\d{2}:\d{2}(:\d{2})?$/, 'Time must be in HH:MM format');

export const createTimetableSlotSchema = z.object({
  classId: z.string().uuid('Class is required'),
  teacherId: z.string().uuid('Teacher is required'),
  dayOfWeek: z.coerce.number().int().min(1).max(5),
  learningAreaId: z.string().uuid('Learning area is required'),
  startTime: timeField,
  endTime: timeField,
  room: z
    .string()
    .trim()
    .max(50, 'Room must be 50 characters or fewer')
    .optional()
    .transform((value) => (value ? value : undefined)),
});

export const updateTimetableSlotSchema = z.object({
  classId: z.string().uuid().optional(),
  teacherId: z.string().uuid().optional(),
  dayOfWeek: z.coerce.number().int().min(1).max(5).optional(),
  learningAreaId: z.string().uuid().optional(),
  startTime: timeField.optional(),
  endTime: timeField.optional(),
  room: z
    .string()
    .trim()
    .max(50, 'Room must be 50 characters or fewer')
    .optional()
    .transform((value) => (value ? value : undefined)),
  isActive: z.boolean().optional(),
}).refine((value) => Object.keys(value).length > 0, {
  message: 'At least one field is required',
});
