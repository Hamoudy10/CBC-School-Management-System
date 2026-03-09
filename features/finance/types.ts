// features/finance/types.ts
// ============================================================
// Type definitions for Finance Module
// Covers: fee structures, student fees, payments, dashboard
// ============================================================

// ============================================================
// Fee Status
// ============================================================
export type FeeStatus = "pending" | "partial" | "paid" | "overdue" | "waived";

// ============================================================
// Payment Method
// ============================================================
export type PaymentMethod =
  | "cash"
  | "bank_transfer"
  | "mpesa"
  | "cheque"
  | "other";

// ============================================================
// Fee Structure
// ============================================================
export interface FeeStructure {
  id: string;
  schoolId: string;
  name: string;
  description: string | null;
  amount: number;
  academicYearId: string;
  academicYear?: string;
  termId: string | null;
  termName?: string;
  gradeId: string | null;
  gradeName?: string;
  isMandatory: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  createdBy: string | null;
}

export interface CreateFeeStructurePayload {
  name: string;
  description?: string;
  amount: number;
  academicYearId: string;
  termId?: string;
  gradeId?: string;
  isMandatory?: boolean;
}

export interface UpdateFeeStructurePayload {
  name?: string;
  description?: string;
  amount?: number;
  isMandatory?: boolean;
  isActive?: boolean;
}

// ============================================================
// Student Fee (assigned fee)
// ============================================================
export interface StudentFee {
  id: string;
  schoolId: string;
  studentId: string;
  studentName?: string;
  studentAdmissionNo?: string;
  feeStructureId: string;
  feeStructureName?: string;
  amountDue: number;
  amountPaid: number;
  balance: number;
  dueDate: string | null;
  status: FeeStatus;
  academicYearId: string;
  academicYear?: string;
  termId: string | null;
  termName?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateStudentFeePayload {
  studentId: string;
  feeStructureId: string;
  amountDue?: number;
  dueDate?: string;
  academicYearId: string;
  termId?: string;
}

export interface BulkAssignFeesPayload {
  classId: string;
  feeStructureId: string;
  academicYearId: string;
  termId?: string;
  dueDate?: string;
}

// ============================================================
// Payment
// ============================================================
export interface Payment {
  id: string;
  schoolId: string;
  studentFeeId: string;
  studentId?: string;
  studentName?: string;
  studentAdmissionNo?: string;
  feeStructureName?: string;
  amountPaid: number;
  paymentMethod: PaymentMethod;
  transactionId: string | null;
  receiptNumber: string | null;
  paymentDate: string;
  notes: string | null;
  recordedBy: string;
  recordedByName?: string;
  createdAt: string;
}

export interface CreatePaymentPayload {
  studentFeeId: string;
  amountPaid: number;
  paymentMethod: PaymentMethod;
  transactionId?: string;
  receiptNumber?: string;
  paymentDate?: string;
  notes?: string;
}

// ============================================================
// Dashboard Metrics
// ============================================================
export interface FinanceDashboardMetrics {
  totalFeesDue: number;
  totalCollected: number;
  totalPending: number;
  totalOverdue: number;
  collectionRate: number;
  studentCount: number;
  fullyPaidCount: number;
  partialPaidCount: number;
  unpaidCount: number;
}

export interface FeeCollectionByCategory {
  feeStructureId: string;
  feeStructureName: string;
  totalDue: number;
  totalCollected: number;
  collectionRate: number;
}

export interface FeeCollectionByTerm {
  termId: string;
  termName: string;
  totalDue: number;
  totalCollected: number;
  collectionRate: number;
}

export interface FeeCollectionByClass {
  classId: string;
  className: string;
  gradeName: string;
  totalStudents: number;
  totalDue: number;
  totalCollected: number;
  collectionRate: number;
}

export interface FeeCollectionTrend {
  date: string;
  amount: number;
  cumulativeAmount: number;
}

export interface StudentFeeStatement {
  student: {
    id: string;
    name: string;
    admissionNo: string;
    className: string;
  };
  fees: StudentFee[];
  payments: Payment[];
  summary: {
    totalDue: number;
    totalPaid: number;
    balance: number;
  };
}

// ============================================================
// Filters
// ============================================================
export interface FeeStructureFilters {
  search?: string;
  academicYearId?: string;
  termId?: string;
  gradeId?: string;
  isActive?: boolean;
  page?: number;
  pageSize?: number;
}

export interface StudentFeeFilters {
  studentId?: string;
  classId?: string;
  feeStructureId?: string;
  academicYearId?: string;
  termId?: string;
  status?: FeeStatus;
  page?: number;
  pageSize?: number;
}

export interface PaymentFilters {
  studentFeeId?: string;
  studentId?: string;
  paymentMethod?: PaymentMethod;
  startDate?: string;
  endDate?: string;
  page?: number;
  pageSize?: number;
}

export interface DashboardFilters {
  academicYearId: string;
  termId?: string;
  classId?: string;
  gradeId?: string;
}
