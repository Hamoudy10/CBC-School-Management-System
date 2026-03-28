// features/settings/validators/settings.schema.ts
// Zod validation schemas for settings inputs

import { z } from "zod";

const gradingSystemSchema = z.union([
  z.enum(["cbc_4point", "percentage", "letter_grade"]),
  z.literal("cbc_4_point"),
]);

const schoolDaySchema = z.enum([
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
]);

export const updateSchoolProfileSchema = z.object({
  name: z
    .string()
    .min(2, "School name must be at least 2 characters")
    .max(200)
    .optional(),
  type: z.enum(["primary", "secondary", "mixed", "academy"]).optional(),
  address: z.string().max(500).optional().or(z.literal("")),
  county: z.string().max(100).optional().or(z.literal("")),
  sub_county: z.string().max(100).optional().or(z.literal("")),
  contact_email: z.string().email("Invalid email").optional().or(z.literal("")),
  contact_phone: z
    .string()
    .regex(/^\+?[\d\s-]{10,15}$/, "Invalid phone number")
    .optional()
    .or(z.literal("")),
  secondary_phone: z
    .string()
    .regex(/^\+?[\d\s-]{10,15}$/)
    .optional()
    .or(z.literal("")),
  website: z.string().url("Invalid URL").optional().or(z.literal("")),
  motto: z.string().max(200).optional().or(z.literal("")),
  mission: z.string().max(1000).optional().or(z.literal("")),
  vision: z.string().max(1000).optional().or(z.literal("")),
  registration_number: z.string().max(50).optional().or(z.literal("")),
  established_year: z
    .number()
    .int()
    .min(1900)
    .max(new Date().getFullYear())
    .optional(),
});

export const createAcademicYearSchema = z
  .object({
    year: z.string().regex(/^\d{4}$/, "Year must be 4-digit format"),
    start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Must be YYYY-MM-DD"),
    end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Must be YYYY-MM-DD"),
  })
  .refine((data) => data.start_date < data.end_date, {
    message: "End date must be after start date",
    path: ["end_date"],
  });

export const updateAcademicYearSchema = z
  .object({
    year: z
      .string()
      .regex(/^\d{4}$/, "Year must be 4-digit format")
      .optional(),
    start_date: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Must be YYYY-MM-DD")
      .optional(),
    end_date: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Must be YYYY-MM-DD")
      .optional(),
  })
  .refine(
    (data) =>
      !data.start_date || !data.end_date || data.start_date < data.end_date,
    {
      message: "End date must be after start date",
      path: ["end_date"],
    },
  );

export const createTermSchema = z
  .object({
    academic_year_id: z.string().uuid("Invalid academic year ID"),
    name: z.enum(["Term 1", "Term 2", "Term 3"]),
    start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  })
  .refine((data) => data.start_date < data.end_date, {
    message: "End date must be after start date",
    path: ["end_date"],
  });

export const updateTermSchema = z
  .object({
    name: z.enum(["Term 1", "Term 2", "Term 3"]).optional(),
    start_date: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .optional(),
    end_date: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .optional(),
  })
  .refine(
    (data) =>
      !data.start_date || !data.end_date || data.start_date < data.end_date,
    {
      message: "End date must be after start date",
      path: ["end_date"],
    },
  );

export const createClassSchema = z.object({
  name: z.string().min(1, "Class name is required").max(50),
  grade_level: z
    .number()
    .int()
    .min(1, "Grade level must be at least 1")
    .max(12),
  stream: z.string().max(20).optional(),
  capacity: z.number().int().min(1).max(100).default(45),
  class_teacher_id: z.string().uuid().optional(),
  academic_year: z.string().regex(/^\d{4}$/),
});

export const updateClassSchema = z.object({
  name: z.string().min(1).max(50).optional(),
  stream: z.string().max(20).optional().or(z.literal("")),
  capacity: z.number().int().min(1).max(100).optional(),
  class_teacher_id: z.string().uuid().optional().or(z.literal("")),
  status: z.enum(["active", "inactive"]).optional(),
});

export const updateSettingsSchema = z.object({
  academic: z
    .object({
      grading_system: gradingSystemSchema.optional(),
      allow_teacher_report_comments: z.boolean().optional(),
      require_principal_approval: z.boolean().optional(),
      attendance_threshold_warning: z.number().min(50).max(100).optional(),
      attendance_threshold_critical: z.number().min(30).max(100).optional(),
    })
    .optional(),
  finance: z
    .object({
      currency: z.string().min(1).max(10).optional(),
      currency_symbol: z.string().min(1).max(10).optional(),
      payment_reminder_days: z
        .array(z.number().int().min(1).max(90))
        .min(1)
        .optional(),
      allow_partial_payments: z.boolean().optional(),
      generate_receipts: z.boolean().optional(),
      overdue_penalty_enabled: z.boolean().optional(),
      overdue_penalty_rate: z.number().min(0).max(100).optional(),
    })
    .optional(),
  communication: z
    .object({
      allow_parent_messaging: z.boolean().optional(),
      allow_teacher_parent_messaging: z.boolean().optional(),
      announcement_approval_required: z.boolean().optional(),
      max_message_recipients: z.number().int().min(1).max(500).optional(),
    })
    .optional(),
  general: z
    .object({
      timezone: z.string().min(1).max(100).optional(),
      date_format: z
        .enum(["DD/MM/YYYY", "MM/DD/YYYY", "YYYY-MM-DD"])
        .optional(),
      school_days: z.array(schoolDaySchema).min(1).max(7).optional(),
      term_dates_visible_to_parents: z.boolean().optional(),
      show_student_rankings: z.boolean().optional(),
    })
    .optional(),
});

export type UpdateSchoolProfileInput = z.infer<
  typeof updateSchoolProfileSchema
>;
export type CreateAcademicYearInput = z.infer<typeof createAcademicYearSchema>;
export type UpdateAcademicYearInput = z.infer<typeof updateAcademicYearSchema>;
export type CreateTermInput = z.infer<typeof createTermSchema>;
export type UpdateTermInput = z.infer<typeof updateTermSchema>;
export type CreateClassInput = z.infer<typeof createClassSchema>;
export type UpdateClassInput = z.infer<typeof updateClassSchema>;
export type UpdateSettingsInput = z.infer<typeof updateSettingsSchema>;
