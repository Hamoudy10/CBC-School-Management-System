export const dynamic = 'force-dynamic';

import { z } from "zod";
import { withPermission } from "@/lib/api/withAuth";
import {
  createdResponse,
  errorResponse,
  validationErrorResponse,
} from "@/lib/api/response";
import { validateBody } from "@/lib/api/validation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { calculateFeeStatus } from "@/features/finance";

const bulkAssignSchema = z.object({
  feeStructureId: z.string().uuid(),
  assignmentType: z.enum(["all", "grade", "class"]),
  gradeId: z.string().uuid().optional(),
  classId: z.string().uuid().optional(),
  overwriteExisting: z.boolean().default(false),
});

function requireAssignmentTarget(payload: z.infer<typeof bulkAssignSchema>) {
  if ((payload.assignmentType === "grade" || payload.assignmentType === "class") && !payload.gradeId) {
    return "Select a grade for this assignment.";
  }

  if (payload.assignmentType === "class" && !payload.classId) {
    return "Select a class for this assignment.";
  }

  return null;
}

async function getInvoiceStart(supabase: any, schoolId: string) {
  const year = new Date().getFullYear();
  const month = String(new Date().getMonth() + 1).padStart(2, "0");
  const { count } = await supabase
    .from("student_fees")
    .select("id", { count: "exact", head: true })
    .eq("school_id", schoolId)
    .gte("created_at", `${year}-${month}-01`);

  return (count || 0) + 1;
}

function formatInvoice(sequence: number) {
  const year = new Date().getFullYear();
  const month = String(new Date().getMonth() + 1).padStart(2, "0");
  return `INV-${year}${month}-${String(sequence).padStart(5, "0")}`;
}

export const POST = withPermission("finance", "create", async (request, { user }) => {
  const validation = await validateBody(request, bulkAssignSchema);

  if (!validation.success) {
    return validationErrorResponse(validation.errors!);
  }

  const payload = validation.data!;
  const targetError = requireAssignmentTarget(payload);
  if (targetError) {
    return errorResponse(targetError, 400);
  }

  const supabase = await createSupabaseServerClient();
  const { data: feeStructure, error: feeError } = await supabase
    .from("fee_structures")
    .select("id, school_id, amount, academic_year_id, term_id, grade_id, is_active")
    .eq("id", payload.feeStructureId)
    .eq("school_id", user.schoolId!)
    .single();

  if (feeError || !feeStructure) {
    return errorResponse("Fee structure not found.", 404);
  }

  if (!(feeStructure as any).is_active) {
    return errorResponse("Inactive fee structures cannot be assigned.", 400);
  }

  let studentQuery = supabase
    .from("students")
    .select("student_id, current_class_id")
    .eq("school_id", user.schoolId!)
    .eq("status", "active");

  if (payload.assignmentType === "class") {
    studentQuery = studentQuery.eq("current_class_id", payload.classId!);
  } else if (payload.assignmentType === "grade") {
    const { data: classes, error: classesError } = await supabase
      .from("classes")
      .select("class_id")
      .eq("school_id", user.schoolId!)
      .eq("grade_id", payload.gradeId!);

    if (classesError) {
      return errorResponse(classesError.message, 500);
    }

    const classIds = (classes ?? []).map((row: any) => row.class_id);
    if (classIds.length === 0) {
      return createdResponse({ assignedCount: 0, skippedCount: 0, updatedCount: 0 });
    }

    studentQuery = studentQuery.in("current_class_id", classIds);
  }

  const { data: students, error: studentsError } = await studentQuery;

  if (studentsError) {
    return errorResponse(studentsError.message, 500);
  }

  const studentIds = (students ?? []).map((row: any) => row.student_id);
  if (studentIds.length === 0) {
    return createdResponse({
      assignedCount: 0,
      updatedCount: 0,
      skippedCount: 0,
      message: "No active students matched this assignment.",
    });
  }

  let existingAssignmentsQuery = supabase
    .from("student_fees")
    .select("id, student_id, amount_paid, due_date")
    .eq("school_id", user.schoolId!)
    .eq("fee_structure_id", payload.feeStructureId)
    .eq("academic_year_id", (feeStructure as any).academic_year_id)
    .in("student_id", studentIds);

  if ((feeStructure as any).term_id) {
    existingAssignmentsQuery = existingAssignmentsQuery.eq(
      "term_id",
      (feeStructure as any).term_id,
    );
  } else {
    existingAssignmentsQuery = existingAssignmentsQuery.is("term_id", null);
  }

  const { data: existingAssignments, error: existingError } =
    await existingAssignmentsQuery;

  if (existingError) {
    return errorResponse(existingError.message, 500);
  }

  const existingMap = new Map(
    (existingAssignments ?? []).map((row: any) => [row.student_id, row]),
  );

  let invoiceSequence = await getInvoiceStart(supabase, user.schoolId!);
  let assignedCount = 0;
  let updatedCount = 0;
  let skippedCount = 0;

  for (const student of students ?? []) {
    const existing = existingMap.get((student as any).student_id);

    if (existing) {
      if (!payload.overwriteExisting) {
        skippedCount += 1;
        continue;
      }

      const amountDue = Number((feeStructure as any).amount || 0);
      const amountPaid = Number(existing.amount_paid || 0);
      const dueDate = existing.due_date ?? null;
      const status = calculateFeeStatus(amountDue, amountPaid, dueDate);

      const { error: updateError } = await supabase
        .from("student_fees")
        .update({
          amount_due: amountDue,
          due_date: dueDate,
          status,
          updated_at: new Date().toISOString(),
        })
        .eq("id", existing.id);

      if (updateError) {
        skippedCount += 1;
      } else {
        updatedCount += 1;
      }

      continue;
    }

    const { error: insertError } = await supabase.from("student_fees").insert({
      school_id: user.schoolId!,
      student_id: (student as any).student_id,
      fee_structure_id: payload.feeStructureId,
      amount_due: (feeStructure as any).amount,
      amount_paid: 0,
      due_date: null,
      status: "pending",
      academic_year_id: (feeStructure as any).academic_year_id,
      term_id: (feeStructure as any).term_id,
      invoice_number: formatInvoice(invoiceSequence),
      created_by: user.id,
    });

    invoiceSequence += 1;

    if (insertError) {
      skippedCount += 1;
    } else {
      assignedCount += 1;
    }
  }

  return createdResponse(
    {
      assignedCount,
      updatedCount,
      skippedCount,
    },
    "Fee assignment completed.",
  );
});
