// @ts-nocheck
// features/finance/services/studentFees.service.ts
// ============================================================
// Student Fees CRUD service
// Handles fee assignment, status calculation
// ============================================================

import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { AuthUser } from "@/types/auth";
import type { StudentFee, FeeStatus } from "../types";
import type {
  CreateStudentFeeInput,
  BulkAssignFeesInput,
  StudentFeeFiltersInput,
} from "../validators/finance.schema";
import type { PaginatedResponse } from "@/features/users/types";

// ============================================================
// CALCULATE FEE STATUS
// ============================================================
export function calculateFeeStatus(
  amountDue: number,
  amountPaid: number,
  dueDate: string | null,
): FeeStatus {
  if (amountPaid >= amountDue) return "paid";
  if (amountPaid > 0) return "partial";

  if (dueDate) {
    const today = new Date();
    const due = new Date(dueDate);
    if (today > due) return "overdue";
  }

  return "pending";
}

// ============================================================
// LIST STUDENT FEES
// ============================================================
export async function listStudentFees(
  filters: StudentFeeFiltersInput,
  currentUser: AuthUser,
): Promise<PaginatedResponse<StudentFee>> {
  const supabase: any = await createSupabaseServerClient();
  const { page, pageSize } = filters;
  const offset = (page - 1) * pageSize;

  let query = supabase.from("student_fees").select(
    `
      *,
      students (
        first_name,
        last_name,
        admission_number
      ),
      fee_structures (
        name,
        amount
      ),
      academic_years (
        year
      ),
      terms (
        name
      )
    `,
    { count: "exact" },
    );

  // School scoping
  if (currentUser.role !== "super_admin") {
    query = query.eq("school_id", currentUser.schoolId!);
  }

  // Parents see only their children's fees
  if (currentUser.role === "parent") {
    const { data: guardianLinks } = await supabase
      .from("student_guardians")
      .select("student_id")
      .eq("guardian_user_id", currentUser.id);

    const childIds = guardianLinks?.map((g) => g.student_id) || [];
    if (childIds.length === 0) {
      return { data: [], total: 0, page, pageSize, totalPages: 0 };
    }
    query = query.in("student_id", childIds);
  }

  // Students see only their own fees
  if (currentUser.role === "student") {
    const { data: studentRecord } = await supabase
      .from("students")
      .select("student_id")
      .eq("user_id", currentUser.id)
      .single();

    if (!studentRecord) {
      return { data: [], total: 0, page, pageSize, totalPages: 0 };
    }
    query = query.eq("student_id", studentRecord.student_id);
  }

  // Filters
  if (filters.studentId) {
    query = query.eq("student_id", filters.studentId);
  }
  if (filters.feeStructureId) {
    query = query.eq("fee_structure_id", filters.feeStructureId);
  }
  if (filters.academicYearId) {
    query = query.eq("academic_year_id", filters.academicYearId);
  }
  if (filters.termId) {
    query = query.eq("term_id", filters.termId);
  }
  if (filters.status) {
    query = query.eq("status", filters.status);
  }

  query = query
    .order("created_at", { ascending: false })
    .range(offset, offset + pageSize - 1);

  const { data, error, count } = await query;

  if (error) {
    throw new Error(`Failed to list student fees: ${error.message}`);
  }

  const items: StudentFee[] = (data || []).map((row: any) => ({
    id: row.id,
    schoolId: row.school_id,
    studentId: row.student_id,
    studentName: row.students
      ? `${row.students.first_name} ${row.students.last_name}`
      : undefined,
    studentAdmissionNo: row.students?.admission_number ?? undefined,
    feeStructureId: row.fee_structure_id,
    feeStructureName: row.fee_structures?.name ?? undefined,
    amountDue: parseFloat(row.amount_due),
    amountPaid: parseFloat(row.amount_paid),
    balance: parseFloat(row.balance),
    dueDate: row.due_date,
    status: row.status as FeeStatus,
    academicYearId: row.academic_year_id,
    academicYear: row.academic_years?.year ?? undefined,
    termId: row.term_id,
    termName: row.terms?.name ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));

  const total = count || 0;

  return {
    data: items,
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  };
}

// ============================================================
// GET STUDENT FEE BY ID
// ============================================================
export async function getStudentFeeById(
  id: string,
  currentUser: AuthUser,
): Promise<StudentFee | null> {
  const supabase: any = await createSupabaseServerClient();

  let query = supabase
    .from("student_fees")
    .select(
      `
      *,
      students (
        first_name,
        last_name,
        admission_number
      ),
      fee_structures (
        name
      ),
      academic_years (
        year
      ),
      terms (
        name
      )
    `,
    )
    .eq("id", id);

  if (currentUser.role !== "super_admin") {
    query = query.eq("school_id", currentUser.schoolId!);
  }

  const { data, error } = await query.single();

  if (error || !data) return null;

  return {
    id: data.id,
    schoolId: data.school_id,
    studentId: data.student_id,
    studentName: data.students
      ? `${data.students.first_name} ${data.students.last_name}`
      : undefined,
    studentAdmissionNo: data.students?.admission_number ?? undefined,
    feeStructureId: data.fee_structure_id,
    feeStructureName: data.fee_structures?.name ?? undefined,
    amountDue: parseFloat(data.amount_due),
    amountPaid: parseFloat(data.amount_paid),
    balance: parseFloat(data.balance),
    dueDate: data.due_date,
    status: data.status as FeeStatus,
    academicYearId: data.academic_year_id,
    academicYear: data.academic_years?.year ?? undefined,
    termId: data.term_id,
    termName: data.terms?.name ?? undefined,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  };
}

// ============================================================
// CREATE STUDENT FEE (assign fee to student)
// ============================================================
export async function createStudentFee(
  payload: CreateStudentFeeInput,
  currentUser: AuthUser,
): Promise<{ success: boolean; message: string; id?: string }> {
  const supabase: any = await createSupabaseServerClient();
  const schoolId = currentUser.schoolId!;

  // Get fee structure amount if not provided
  let amountDue = payload.amountDue;
  if (amountDue === undefined) {
    const { data: feeStructure } = await supabase
      .from("fee_structures")
      .select("amount")
      .eq("id", payload.feeStructureId)
      .single();

    amountDue = feeStructure?.amount || 0;
  }

  // Check for duplicate assignment
  const { data: existing } = await supabase
    .from("student_fees")
    .select("id")
    .eq("student_id", payload.studentId)
    .eq("fee_structure_id", payload.feeStructureId)
    .eq("academic_year_id", payload.academicYearId)
    .eq("term_id", payload.termId || null)
    .maybeSingle();

  if (existing) {
    return {
      success: false,
      message: "This fee is already assigned to the student for this period.",
    };
  }

  const { data, error } = await supabase
    .from("student_fees")
    .insert({
      school_id: schoolId,
      student_id: payload.studentId,
      fee_structure_id: payload.feeStructureId,
      amount_due: amountDue,
      due_date: payload.dueDate || null,
      academic_year_id: payload.academicYearId,
      term_id: payload.termId || null,
      status: "pending",
      created_by: currentUser.id,
    })
    .select("id")
    .single();

  if (error) {
    return { success: false, message: `Assignment failed: ${error.message}` };
  }

  return {
    success: true,
    message: "Fee assigned successfully.",
    id: data.id,
  };
}

// ============================================================
// BULK ASSIGN FEES TO CLASS
// ============================================================
export async function bulkAssignFees(
  payload: BulkAssignFeesInput,
  currentUser: AuthUser,
): Promise<{
  success: boolean;
  message: string;
  assigned: number;
  skipped: number;
}> {
  const supabase = await createSupabaseServerClient();
  const supabaseAny: any = supabase;
  const schoolId = currentUser.schoolId!;

  // Get all students in the class
  const { data: studentClasses } = await supabaseAny
    .from("student_classes")
    .select("student_id")
    .eq("class_id", payload.classId)
    .eq("academic_year_id", payload.academicYearId)
    .eq("status", "active");

  if (!studentClasses || studentClasses.length === 0) {
    return {
      success: false,
      message: "No students found in this class.",
      assigned: 0,
      skipped: 0,
    };
  }

  // Get fee structure amount
  const { data: feeStructure } = await supabaseAny
    .from("fee_structures")
    .select("amount")
    .eq("id", payload.feeStructureId)
    .single();

  if (!feeStructure) {
    return {
      success: false,
      message: "Fee structure not found.",
      assigned: 0,
      skipped: 0,
    };
  }

  let assigned = 0;
  let skipped = 0;

  for (const sc of studentClasses) {
    // Check if already assigned
    const { data: existing } = await supabaseAny
      .from("student_fees")
      .select("id")
      .eq("student_id", sc.student_id)
      .eq("fee_structure_id", payload.feeStructureId)
      .eq("academic_year_id", payload.academicYearId)
      .eq("term_id", payload.termId || null)
      .maybeSingle();

    if (existing) {
      skipped++;
      continue;
    }

    const { error } = await supabaseAny
      .from("student_fees")
      .insert({
      school_id: schoolId,
      student_id: sc.student_id,
      fee_structure_id: payload.feeStructureId,
      amount_due: feeStructure.amount,
      due_date: payload.dueDate || null,
      academic_year_id: payload.academicYearId,
      term_id: payload.termId || null,
      status: "pending",
      created_by: currentUser.id,
      });

    if (error) {
      skipped++;
    } else {
      assigned++;
    }
  }

  return {
    success: true,
    message: `Fees assigned to ${assigned} students. ${skipped} skipped (already assigned or error).`,
    assigned,
    skipped,
  };
}

// ============================================================
// WAIVE FEE
// ============================================================
export async function waiveFee(
  studentFeeId: string,
  reason: string,
  currentUser: AuthUser,
): Promise<{ success: boolean; message: string }> {
  const supabase: any = await createSupabaseServerClient();

  let query = supabase
    .from("student_fees")
    .update({
      status: "waived",
      // Store waiver reason in notes or a separate audit
    })
    .eq("id", studentFeeId);

  if (currentUser.role !== "super_admin") {
    query = query.eq("school_id", currentUser.schoolId!);
  }

  const { error } = await query;

  if (error) {
    return { success: false, message: `Waiver failed: ${error.message}` };
  }

  return { success: true, message: "Fee waived successfully." };
}

// ============================================================
// UPDATE OVERDUE STATUS (run as cron job)
// ============================================================
export async function updateOverdueStatuses(schoolId: string): Promise<number> {
  const supabase: any = await createSupabaseServerClient();
  const today = new Date().toISOString().split("T")[0];

  const { data, error } = await supabase
    .from("student_fees")
    .update({ status: "overdue" })
    .eq("school_id", schoolId)
    .eq("status", "pending")
    .lt("due_date", today)
    .select("id");

  if (error) {
    throw new Error(`Failed to update overdue statuses: ${error.message}`);
  }

  return data?.length || 0;
}
