// features/finance/validators/finance.schema.ts
// ============================================================
// Zod validation schemas for Finance Module
// ============================================================

import { z } from "zod";

const uuidField = z.string().uuid("Invalid ID format");
const dateField = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD");
const amountField = z.coerce.number().min(0, "Amount cannot be negative");
const positiveAmountField = z.coerce
  .number()
  .positive("Amount must be positive");

// ============================================================
// Fee Structure Schemas
// ============================================================
export const createFeeStructureSchema = z.object({
  name: z.string().min(1, "Name is required").max(150),
  description: z.string().max(1000).optional(),
  amount: amountField,
  academicYearId: uuidField,
  termId: uuidField.optional(),
  gradeId: uuidField.optional(),
  isMandatory: z.boolean().default(true),
});

export type CreateFeeStructureInput = z.infer<typeof createFeeStructureSchema>;

export const updateFeeStructureSchema = z
  .object({
    name: z.string().min(1).max(150).optional(),
    description: z.string().max(1000).optional(),
    amount: amountField.optional(),
    isMandatory: z.boolean().optional(),
    isActive: z.boolean().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field must be provided",
  });

export type UpdateFeeStructureInput = z.infer<typeof updateFeeStructureSchema>;

export const feeStructureFiltersSchema = z.object({
  search: z.string().max(100).optional(),
  academicYearId: uuidField.optional(),
  termId: uuidField.optional(),
  gradeId: uuidField.optional(),
  isActive: z
    .string()
    .transform((v) => v === "true")
    .optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(50),
});

export type FeeStructureFiltersInput = z.infer<
  typeof feeStructureFiltersSchema
>;

// ============================================================
// Student Fee Schemas
// ============================================================
export const createStudentFeeSchema = z.object({
  studentId: uuidField,
  feeStructureId: uuidField,
  amountDue: amountField.optional(),
  dueDate: dateField.optional(),
  academicYearId: uuidField,
  termId: uuidField.optional(),
});

export type CreateStudentFeeInput = z.infer<typeof createStudentFeeSchema>;

export const bulkAssignFeesSchema = z.object({
  classId: uuidField,
  feeStructureId: uuidField,
  academicYearId: uuidField,
  termId: uuidField.optional(),
  dueDate: dateField.optional(),
});

export type BulkAssignFeesInput = z.infer<typeof bulkAssignFeesSchema>;

export const studentFeeFiltersSchema = z.object({
  studentId: uuidField.optional(),
  classId: uuidField.optional(),
  feeStructureId: uuidField.optional(),
  academicYearId: uuidField.optional(),
  termId: uuidField.optional(),
  status: z
    .enum(["pending", "partial", "paid", "overdue", "waived"])
    .optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(50),
});

export type StudentFeeFiltersInput = z.infer<typeof studentFeeFiltersSchema>;

// ============================================================
// Payment Schemas
// ============================================================
export const createPaymentSchema = z.object({
  studentFeeId: uuidField,
  amountPaid: positiveAmountField,
  paymentMethod: z.enum(["cash", "bank_transfer", "mpesa", "cheque", "other"]),
  transactionId: z.string().max(100).optional(),
  receiptNumber: z.string().max(100).optional(),
  paymentDate: dateField.optional(),
  notes: z.string().max(500).optional(),
});

export type CreatePaymentInput = z.infer<typeof createPaymentSchema>;

export const updatePaymentSchema = z
  .object({
    amountPaid: positiveAmountField.optional(),
    paymentMethod: z
      .enum(["cash", "bank_transfer", "mpesa", "cheque", "other"])
      .optional(),
    transactionId: z.string().max(100).optional(),
    paymentDate: dateField.optional(),
    notes: z.string().max(500).optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field must be provided",
  });

export type UpdatePaymentInput = z.infer<typeof updatePaymentSchema>;

export const refundPaymentSchema = z.object({
  reason: z.string().min(1, "Reason is required").max(500),
});

export type RefundPaymentInput = z.infer<typeof refundPaymentSchema>;

export const financeExceptionFiltersSchema = z.object({
  type: z
    .enum(["fee_waiver", "payment_refund", "payment_adjustment"])
    .optional(),
  studentId: uuidField.optional(),
  startDate: dateField.optional(),
  endDate: dateField.optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

export type FinanceExceptionFiltersInput = z.infer<
  typeof financeExceptionFiltersSchema
>;

export const paymentFiltersSchema = z.object({
  studentFeeId: uuidField.optional(),
  studentId: uuidField.optional(),
  paymentMethod: z
    .enum(["cash", "bank_transfer", "mpesa", "cheque", "other"])
    .optional(),
  startDate: dateField.optional(),
  endDate: dateField.optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(50),
});

export type PaymentFiltersInput = z.infer<typeof paymentFiltersSchema>;

// ============================================================
// Dashboard Filters Schema
// ============================================================
export const dashboardFiltersSchema = z.object({
  academicYearId: uuidField,
  termId: uuidField.optional(),
  classId: uuidField.optional(),
  gradeId: uuidField.optional(),
});

export type DashboardFiltersInput = z.infer<typeof dashboardFiltersSchema>;

// ============================================================
// Student Statement Schema
// ============================================================
export const studentStatementSchema = z.object({
  studentId: uuidField,
  academicYearId: uuidField,
});

export type StudentStatementInput = z.infer<typeof studentStatementSchema>;

// ============================================================
// Waive Fee Schema
// ============================================================
export const waiveFeeSchema = z.object({
  studentFeeId: uuidField,
  reason: z.string().min(1, "Reason is required").max(500),
});

export type WaiveFeeInput = z.infer<typeof waiveFeeSchema>;
