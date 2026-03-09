// features/finance/index.ts
// ============================================================
// Public API for Finance Module
// ============================================================

// Types
export type {
  FeeStatus,
  PaymentMethod,
  FeeStructure,
  StudentFee,
  Payment,
  FinanceDashboardMetrics,
  FeeCollectionByCategory,
  FeeCollectionByTerm,
  FeeCollectionByClass,
  FeeCollectionTrend,
  StudentFeeStatement,
  CreateFeeStructurePayload,
  UpdateFeeStructurePayload,
  CreateStudentFeePayload,
  BulkAssignFeesPayload,
  CreatePaymentPayload,
  FeeStructureFilters,
  StudentFeeFilters,
  PaymentFilters,
  DashboardFilters,
} from "./types";

// Validators
export {
  createFeeStructureSchema,
  updateFeeStructureSchema,
  feeStructureFiltersSchema,
  createStudentFeeSchema,
  bulkAssignFeesSchema,
  studentFeeFiltersSchema,
  createPaymentSchema,
  paymentFiltersSchema,
  dashboardFiltersSchema,
  studentStatementSchema,
  waiveFeeSchema,
} from "./validators/finance.schema";

// Services — Fee Structures
export {
  listFeeStructures,
  getFeeStructureById,
  createFeeStructure,
  updateFeeStructure,
  deleteFeeStructure,
} from "./services/feeStructures.service";

// Services — Student Fees
export {
  listStudentFees,
  getStudentFeeById,
  createStudentFee,
  bulkAssignFees,
  waiveFee,
  updateOverdueStatuses,
  calculateFeeStatus,
} from "./services/studentFees.service";

// Services — Payments
export {
  listPayments,
  getPaymentById,
  createPayment,
  getPaymentsForStudentFee,
  getTotalPaymentsToday,
  generateReceiptNumber,
} from "./services/payments.service";

// Services — Dashboard
export {
  getDashboardMetrics,
  getCollectionByCategory,
  getCollectionByTerm,
  getCollectionByClass,
  getCollectionTrend,
  getStudentFeeStatement,
  getDefaultersList,
} from "./services/dashboard.service";
