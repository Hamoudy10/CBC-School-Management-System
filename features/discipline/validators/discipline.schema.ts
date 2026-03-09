// features/discipline/validators/discipline.schema.ts
// Zod validation schemas for discipline inputs

import { z } from "zod";

const incidentTypeEnum = z.enum([
  "misconduct",
  "bullying",
  "truancy",
  "property_damage",
  "academic_dishonesty",
  "insubordination",
  "fighting",
  "substance_abuse",
  "dress_code",
  "late_coming",
  "other",
]);

const severityEnum = z.enum(["minor", "moderate", "major", "critical"]);

const actionTakenEnum = z.enum([
  "verbal_warning",
  "written_warning",
  "parent_notification",
  "detention",
  "suspension",
  "counseling_referral",
  "community_service",
  "expulsion",
  "other",
]);

const incidentStatusEnum = z.enum([
  "open",
  "under_review",
  "resolved",
  "escalated",
  "closed",
]);

const termEnum = z.enum(["Term 1", "Term 2", "Term 3"]);

export const createDisciplineSchema = z.object({
  student_id: z.string().uuid("Invalid student ID"),
  incident_type: incidentTypeEnum,
  severity: severityEnum,
  description: z
    .string()
    .min(10, "Description must be at least 10 characters")
    .max(2000, "Description must be under 2000 characters"),
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD format"),
  time: z
    .string()
    .regex(/^\d{2}:\d{2}$/, "Time must be HH:MM format")
    .optional(),
  location: z
    .string()
    .max(200, "Location must be under 200 characters")
    .optional(),
  witnesses: z
    .string()
    .max(500, "Witnesses field must be under 500 characters")
    .optional(),
  action_taken: actionTakenEnum,
  action_details: z
    .string()
    .max(1000, "Action details must be under 1000 characters")
    .optional(),
  parent_notified: z.boolean().default(false),
  parent_notified_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD format")
    .optional(),
  term: termEnum,
  academic_year: z
    .string()
    .regex(/^\d{4}$/, "Academic year must be 4-digit year"),
});

export const updateDisciplineSchema = z.object({
  status: incidentStatusEnum.optional(),
  action_taken: actionTakenEnum.optional(),
  action_details: z.string().max(1000).optional(),
  follow_up_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  follow_up_notes: z.string().max(2000).optional(),
  parent_notified: z.boolean().optional(),
  parent_notified_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  reviewed_by: z.string().uuid().optional(),
});

export const disciplineFilterSchema = z.object({
  student_id: z.string().uuid().optional(),
  class_id: z.string().uuid().optional(),
  incident_type: incidentTypeEnum.optional(),
  severity: severityEnum.optional(),
  status: incidentStatusEnum.optional(),
  date_from: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  date_to: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  term: termEnum.optional(),
  academic_year: z
    .string()
    .regex(/^\d{4}$/)
    .optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export type CreateDisciplineInput = z.infer<typeof createDisciplineSchema>;
export type UpdateDisciplineInput = z.infer<typeof updateDisciplineSchema>;
export type DisciplineFilterInput = z.infer<typeof disciplineFilterSchema>;
