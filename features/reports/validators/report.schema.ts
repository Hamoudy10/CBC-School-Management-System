// features/reports/validators/report.schema.ts
// Zod validation schemas for report generation

import { z } from "zod";

const termEnum = z.enum(["Term 1", "Term 2", "Term 3"]);
const reportFormatEnum = z.enum(["pdf", "csv", "json"]);
const reportTypeEnum = z.enum([
  "student_report_card",
  "class_report",
  "attendance_report",
  "finance_report",
  "discipline_report",
  "performance_analytics",
  "fee_collection",
  "defaulters_list",
  "teacher_performance",
]);

export const generateReportCardSchema = z.object({
  student_id: z.string().uuid("Invalid student ID"),
  term: termEnum,
  academic_year: z
    .string()
    .regex(/^\d{4}$/, "Academic year must be 4-digit year"),
});

export const generateClassReportSchema = z.object({
  class_id: z.string().uuid("Invalid class ID"),
  term: termEnum,
  academic_year: z
    .string()
    .regex(/^\d{4}$/, "Academic year must be 4-digit year"),
});

export const generateBatchReportSchema = z.object({
  class_id: z.string().uuid("Invalid class ID"),
  term: termEnum,
  academic_year: z
    .string()
    .regex(/^\d{4}$/, "Academic year must be 4-digit year"),
});

export const reportRequestSchema = z.object({
  report_type: reportTypeEnum,
  format: reportFormatEnum.default("pdf"),
  parameters: z.record(z.unknown()).default({}),
});

export const reportFilterSchema = z.object({
  report_type: reportTypeEnum.optional(),
  status: z.enum(["pending", "generating", "completed", "failed"]).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(20),
});

export type GenerateReportCardInput = z.infer<typeof generateReportCardSchema>;
export type GenerateClassReportInput = z.infer<
  typeof generateClassReportSchema
>;
export type GenerateBatchReportInput = z.infer<
  typeof generateBatchReportSchema
>;
export type ReportRequestInput = z.infer<typeof reportRequestSchema>;
export type ReportFilterInput = z.infer<typeof reportFilterSchema>;
