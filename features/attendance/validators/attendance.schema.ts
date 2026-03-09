// features/attendance/validators/attendance.schema.ts
// Zod validation schemas for attendance inputs

import { z } from "zod";

const attendanceStatusEnum = z.enum(["present", "absent", "late", "excused"]);
const termEnum = z.enum(["Term 1", "Term 2", "Term 3"]);

export const recordAttendanceSchema = z.object({
  student_id: z.string().uuid("Invalid student ID"),
  class_id: z.string().uuid("Invalid class ID"),
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD format"),
  status: attendanceStatusEnum,
  remarks: z
    .string()
    .max(500, "Remarks must be under 500 characters")
    .optional(),
  term: termEnum,
  academic_year: z
    .string()
    .regex(/^\d{4}$/, "Academic year must be 4-digit year"),
});

export const bulkAttendanceSchema = z.object({
  class_id: z.string().uuid("Invalid class ID"),
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD format"),
  term: termEnum,
  academic_year: z
    .string()
    .regex(/^\d{4}$/, "Academic year must be 4-digit year"),
  entries: z
    .array(
      z.object({
        student_id: z.string().uuid("Invalid student ID"),
        status: attendanceStatusEnum,
        remarks: z.string().max(500).optional(),
      }),
    )
    .min(1, "At least one attendance entry required")
    .max(100, "Maximum 100 entries per batch"),
});

export const attendanceFilterSchema = z.object({
  student_id: z.string().uuid().optional(),
  class_id: z.string().uuid().optional(),
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  date_from: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  date_to: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  status: attendanceStatusEnum.optional(),
  term: termEnum.optional(),
  academic_year: z
    .string()
    .regex(/^\d{4}$/)
    .optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(200).default(50),
});

export const attendanceSummaryFilterSchema = z.object({
  student_id: z.string().uuid("Invalid student ID").optional(),
  class_id: z.string().uuid("Invalid class ID").optional(),
  date_from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date format"),
  date_to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date format"),
  term: termEnum.optional(),
  academic_year: z
    .string()
    .regex(/^\d{4}$/)
    .optional(),
});

export type RecordAttendanceInput = z.infer<typeof recordAttendanceSchema>;
export type BulkAttendanceInput = z.infer<typeof bulkAttendanceSchema>;
export type AttendanceFilterInput = z.infer<typeof attendanceFilterSchema>;
export type AttendanceSummaryFilterInput = z.infer<
  typeof attendanceSummaryFilterSchema
>;
