import { z } from "zod";

const attendanceStatusEnum = z.enum(["present", "absent", "late", "excused"]);
const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD format");
const timeSchema = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/, "Time must be HH:MM or HH:MM:SS")
  .optional()
  .nullable();

export const recordAttendanceSchema = z.object({
  student_id: z.string().uuid("Invalid student ID"),
  class_id: z.string().uuid("Invalid class ID"),
  date: dateSchema,
  status: attendanceStatusEnum,
  reason: z.string().max(500, "Reason must be under 500 characters").optional().nullable(),
  arrival_time: timeSchema,
  term_id: z.string().uuid("Invalid term ID").optional().nullable(),
});

export const updateAttendanceSchema = z.object({
  class_id: z.string().uuid("Invalid class ID").optional(),
  date: dateSchema.optional(),
  status: attendanceStatusEnum.optional(),
  reason: z.string().max(500, "Reason must be under 500 characters").optional().nullable(),
  arrival_time: timeSchema,
  term_id: z.string().uuid("Invalid term ID").optional().nullable(),
});

export const bulkAttendanceSchema = z.object({
  class_id: z.string().uuid("Invalid class ID"),
  date: dateSchema,
  term_id: z.string().uuid("Invalid term ID").optional().nullable(),
  entries: z
    .array(
      z.object({
        student_id: z.string().uuid("Invalid student ID"),
        status: attendanceStatusEnum,
        reason: z.string().max(500).optional().nullable(),
        arrival_time: timeSchema,
      }),
    )
    .min(1, "At least one attendance entry required")
    .max(200, "Maximum 200 entries per batch"),
});

export const attendanceFilterSchema = z.object({
  student_id: z.string().uuid().optional(),
  class_id: z.string().uuid().optional(),
  date: dateSchema.optional(),
  date_from: dateSchema.optional(),
  date_to: dateSchema.optional(),
  status: attendanceStatusEnum.optional(),
  term_id: z.string().uuid().optional(),
  academic_year_id: z.string().uuid().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(200).default(50),
});

export const attendanceSummaryFilterSchema = z.object({
  student_id: z.string().uuid("Invalid student ID").optional(),
  class_id: z.string().uuid("Invalid class ID").optional(),
  date_from: dateSchema,
  date_to: dateSchema,
  term_id: z.string().uuid().optional(),
  academic_year_id: z.string().uuid().optional(),
});

export type RecordAttendanceInput = z.infer<typeof recordAttendanceSchema>;
export type UpdateAttendanceInput = z.infer<typeof updateAttendanceSchema>;
export type BulkAttendanceInput = z.infer<typeof bulkAttendanceSchema>;
export type AttendanceFilterInput = z.infer<typeof attendanceFilterSchema>;
export type AttendanceSummaryFilterInput = z.infer<typeof attendanceSummaryFilterSchema>;
