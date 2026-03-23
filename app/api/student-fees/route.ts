import { NextRequest } from "next/server";
import { z } from "zod";
import { withAuth, withPermission } from "@/lib/api/withAuth";
import {
  createdResponse,
  errorResponse,
  successResponse,
  validationErrorResponse,
} from "@/lib/api/response";
import { validateBody, validateQuery } from "@/lib/api/validation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  createStudentFee,
  listStudentFees,
  studentFeeFiltersSchema,
} from "@/features/finance";

const createStudentFeeSchema = z.object({
  studentId: z.string().uuid(),
  feeStructureId: z.string().uuid(),
  amountDue: z.coerce.number().min(0).optional(),
  dueDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  academicYearId: z.string().uuid(),
  termId: z.string().uuid().optional(),
});

const extendedFiltersSchema = studentFeeFiltersSchema.extend({
  hasBalance: z
    .string()
    .transform((value) => value === "true")
    .optional(),
});

function normalizeStudentFee(row: any) {
  return {
    id: row.id,
    studentId: row.studentId,
    student_id: row.studentId,
    studentName: row.studentName ?? null,
    student_name: row.studentName ?? null,
    studentAdmissionNo: row.studentAdmissionNo ?? null,
    student_admission_no: row.studentAdmissionNo ?? null,
    invoiceNumber: row.invoiceNumber ?? null,
    invoice_number: row.invoiceNumber ?? null,
    feeStructureId: row.feeStructureId,
    fee_structure_id: row.feeStructureId,
    feeName: row.feeStructureName ?? null,
    feeNameDisplay: row.feeStructureName ?? null,
    fee_structure: row.feeStructureName
      ? { name: row.feeStructureName }
      : null,
    amountDue: row.amountDue,
    amount_due: row.amountDue,
    amountPaid: row.amountPaid,
    amount_paid: row.amountPaid,
    balance: row.balance,
    dueDate: row.dueDate,
    due_date: row.dueDate,
    status: row.status,
    academicYearId: row.academicYearId,
    academic_year_id: row.academicYearId,
    academicYear: row.academicYear ?? null,
    academic_year: row.academicYear ? { year: row.academicYear } : null,
    termId: row.termId ?? null,
    term_id: row.termId ?? null,
    termName: row.termName ?? null,
    term: row.termName ? { name: row.termName } : null,
    createdAt: row.createdAt,
    created_at: row.createdAt,
    updatedAt: row.updatedAt,
    updated_at: row.updatedAt,
  };
}

export const GET = withAuth(async (request: NextRequest, { user }) => {
  const { searchParams } = new URL(request.url);
  const validation = validateQuery(searchParams, extendedFiltersSchema);

  if (!validation.success) {
    return validationErrorResponse(validation.errors!);
  }

  const filters = validation.data!;
  const result = await listStudentFees(filters, user);
  let items = result.data.map(normalizeStudentFee);

  if (filters.hasBalance) {
    items = items.filter((item) => Number(item.balance || 0) > 0);
  }

  return successResponse(items, {
    page: result.page,
    pageSize: result.pageSize,
    total: filters.hasBalance ? items.length : result.total,
    totalPages: filters.hasBalance
      ? Math.ceil(items.length / Math.max(1, result.pageSize))
      : result.totalPages,
  });
});

export const POST = withPermission("finance", "create", async (request, { user }) => {
  const validation = await validateBody(request, createStudentFeeSchema);

  if (!validation.success) {
    return validationErrorResponse(validation.errors!);
  }

  const result = await createStudentFee(validation.data!, user);

  if (!result.success) {
    return errorResponse(result.message, 400);
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("student_fees")
    .select(
      `
      *,
      fee_structures(name),
      academic_years(year),
      terms(name)
    `,
    )
    .eq("id", result.id)
    .single();

  if (error) {
    return createdResponse({ studentFeeId: result.id, message: result.message }, result.message);
  }

  return createdResponse(
    {
      studentFeeId: result.id,
      studentFee: {
        id: (data as any).id,
        feeName: (data as any).fee_structures?.name ?? null,
        invoiceNumber: (data as any).invoice_number ?? null,
      },
      message: result.message,
    },
    result.message,
  );
});
