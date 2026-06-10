import type { ModuleName } from "@/types/roles";

export interface DataCatalogEntity {
  table: string;
  module: ModuleName;
  action: "view";
  scopeColumn: string;
  primaryKey: string;
  readableColumns: string[];
  filterableColumns: string[];
  searchableColumns: string[];
  defaultSelect: string[];
  sensitiveColumns?: string[];
  joins?: Record<string, DataCatalogJoin>;
}

export interface DataCatalogJoin {
  table: string;
  select: string;
  relation: string;
  foreignKey: string;
  referencedKey: string;
}

export type SupportedOperation = "count" | "list" | "summary" | "exists";
export type SupportedOperator = "eq" | "neq" | "in" | "gte" | "lte" | "gt" | "lt" | "contains" | "ilike" | "is_null" | "not_null";

export const SUPPORTED_OPERATIONS: SupportedOperation[] = ["count", "list", "summary", "exists"];
export const SUPPORTED_OPERATORS: SupportedOperator[] = ["eq", "neq", "in", "gte", "lte", "gt", "lt", "contains", "ilike", "is_null", "not_null"];

export const SENSITIVE_GLOBAL_PATTERNS = ["password", "secret", "token", "api_key", "auth_provider", "reset_token", "mpesa_consumer_key", "mpesa_consumer_secret", "mpesa_passkey"];

const DATA_CATALOG: Record<string, DataCatalogEntity> = {
  // ── Students ──
  students: {
    table: "students",
    module: "students",
    action: "view",
    scopeColumn: "school_id",
    primaryKey: "student_id",
    readableColumns: [
      "student_id", "admission_number", "first_name", "last_name", "middle_name",
      "gender", "date_of_birth", "current_class_id", "status", "enrollment_date",
      "has_special_needs", "special_needs_details", "medical_info", "nemis_number",
      "birth_certificate_no", "previous_school", "created_at",
    ],
    filterableColumns: [
      "student_id", "admission_number", "current_class_id", "gender", "status",
      "has_special_needs", "enrollment_date", "created_at",
    ],
    searchableColumns: ["first_name", "last_name", "admission_number", "nemis_number"],
    defaultSelect: ["student_id", "admission_number", "first_name", "last_name", "gender", "current_class_id", "status"],
    joins: {
      class: { table: "classes", select: "class_id,name,stream", relation: "classes", foreignKey: "current_class_id", referencedKey: "class_id" },
    },
  },

  // ── Staff ──
  staff: {
    table: "staff",
    module: "teachers",
    action: "view",
    scopeColumn: "school_id",
    primaryKey: "staff_id",
    readableColumns: [
      "staff_id", "user_id", "tsc_number", "position", "employment_date",
      "contract_type", "qualification", "status", "created_at",
    ],
    filterableColumns: [
      "staff_id", "position", "status", "contract_type", "employment_date",
    ],
    searchableColumns: [],
    defaultSelect: ["staff_id", "position", "status"],
    joins: {
      user: { table: "users", select: "user_id,first_name,last_name,email", relation: "users", foreignKey: "user_id", referencedKey: "user_id" },
    },
  },

  // ── Classes ──
  classes: {
    table: "classes",
    module: "classes",
    action: "view",
    scopeColumn: "school_id",
    primaryKey: "class_id",
    readableColumns: [
      "class_id", "name", "stream", "capacity", "class_teacher_id",
      "grade_id", "academic_year_id", "is_active", "created_at",
    ],
    filterableColumns: [
      "class_id", "name", "stream", "is_active", "grade_id", "academic_year_id",
    ],
    searchableColumns: ["name", "stream"],
    defaultSelect: ["class_id", "name", "stream", "capacity", "is_active"],
    joins: {},
  },

  // ── Attendance ──
  attendance: {
    table: "attendance",
    module: "attendance",
    action: "view",
    scopeColumn: "school_id",
    primaryKey: "id",
    readableColumns: [
      "id", "student_id", "class_id", "term_id", "date", "status",
      "reason", "arrival_time", "created_at",
    ],
    filterableColumns: [
      "student_id", "class_id", "term_id", "date", "status",
    ],
    searchableColumns: [],
    defaultSelect: ["id", "student_id", "class_id", "date", "status"],
    joins: {},
  },

  // ── Assessments ──
  assessments: {
    table: "assessments",
    module: "assessments",
    action: "view",
    scopeColumn: "school_id",
    primaryKey: "assessment_id",
    readableColumns: [
      "assessment_id", "student_id", "learning_area_id", "class_id",
      "academic_year_id", "term_id", "score", "level_id", "remarks",
      "assessment_date", "created_at",
    ],
    filterableColumns: [
      "student_id", "learning_area_id", "class_id", "academic_year_id",
      "term_id", "score", "assessment_date",
    ],
    searchableColumns: [],
    defaultSelect: ["assessment_id", "student_id", "learning_area_id", "score", "assessment_date"],
    joins: {},
  },

  // ── Assessment Aggregates ──
  assessment_aggregates: {
    table: "assessment_aggregates",
    module: "assessments",
    action: "view",
    scopeColumn: "school_id",
    primaryKey: "id",
    readableColumns: [
      "id", "student_id", "learning_area_id", "class_id", "academic_year_id",
      "term_id", "total_competencies", "average_score", "overall_level",
      "exceeding_count", "meeting_count", "approaching_count", "below_expectation_count",
    ],
    filterableColumns: [
      "student_id", "learning_area_id", "class_id", "academic_year_id",
      "term_id", "overall_level",
    ],
    searchableColumns: [],
    defaultSelect: ["student_id", "learning_area_id", "average_score", "overall_level"],
    joins: {},
  },

  // ── Report Cards ──
  report_cards: {
    table: "report_cards",
    module: "reports",
    action: "view",
    scopeColumn: "school_id",
    primaryKey: "report_id",
    readableColumns: [
      "report_id", "student_id", "class_id", "academic_year_id", "term_id",
      "report_type", "overall_average", "overall_level", "class_teacher_remarks",
      "principal_remarks", "is_published", "published_at", "generated_at",
    ],
    filterableColumns: [
      "student_id", "class_id", "academic_year_id", "term_id",
      "report_type", "is_published",
    ],
    searchableColumns: [],
    defaultSelect: ["report_id", "student_id", "is_published", "overall_average", "overall_level"],
    joins: {},
  },

  // ── Student Fees ──
  student_fees: {
    table: "student_fees",
    module: "finance",
    action: "view",
    scopeColumn: "school_id",
    primaryKey: "id",
    readableColumns: [
      "id", "student_id", "fee_structure_id", "amount_due", "amount_paid",
      "balance", "due_date", "status", "academic_year_id", "term_id",
      "invoice_number", "created_at",
    ],
    filterableColumns: [
      "student_id", "fee_structure_id", "status", "academic_year_id",
      "term_id", "due_date", "balance", "amount_due",
    ],
    searchableColumns: [],
    defaultSelect: ["id", "student_id", "amount_due", "amount_paid", "balance", "status"],
    sensitiveColumns: ["invoice_number"],
    joins: {},
  },

  // ── Payments ──
  payments: {
    table: "payments",
    module: "finance",
    action: "view",
    scopeColumn: "school_id",
    primaryKey: "id",
    readableColumns: [
      "id", "student_fee_id", "amount_paid", "payment_method",
      "transaction_id", "receipt_number", "payment_date", "notes", "created_at",
    ],
    filterableColumns: [
      "student_fee_id", "payment_method", "payment_date", "created_at",
    ],
    searchableColumns: [],
    defaultSelect: ["id", "student_fee_id", "amount_paid", "payment_method", "payment_date"],
    sensitiveColumns: ["receipt_number"],
    joins: {},
  },

  // ── Fee Structures ──
  fee_structures: {
    table: "fee_structures",
    module: "finance",
    action: "view",
    scopeColumn: "school_id",
    primaryKey: "id",
    readableColumns: [
      "id", "name", "description", "amount", "academic_year_id",
      "term_id", "grade_id", "is_mandatory", "is_active", "created_at",
    ],
    filterableColumns: [
      "id", "academic_year_id", "term_id", "grade_id", "is_mandatory", "is_active",
    ],
    searchableColumns: ["name"],
    defaultSelect: ["id", "name", "amount", "is_mandatory", "is_active"],
    joins: {},
  },

  // ── Messages ──
  messages: {
    table: "messages",
    module: "communication",
    action: "view",
    scopeColumn: "school_id",
    primaryKey: "id",
    readableColumns: [
      "id", "sender_id", "receiver_id", "subject", "body",
      "read_status", "read_at", "is_archived", "priority",
      "is_broadcast", "sent_at", "created_at",
    ],
    filterableColumns: [
      "sender_id", "receiver_id", "read_status", "is_archived",
      "priority", "sent_at", "created_at",
    ],
    searchableColumns: ["subject"],
    defaultSelect: ["id", "sender_id", "receiver_id", "subject", "read_status", "sent_at"],
    sensitiveColumns: ["body"],
    joins: {},
  },

  // ── Announcements ──
  announcements: {
    table: "announcements",
    module: "communication",
    action: "view",
    scopeColumn: "school_id",
    primaryKey: "id",
    readableColumns: [
      "id", "title", "body", "priority", "target_roles",
      "target_class_ids", "is_pinned", "publish_at", "expires_at", "created_at",
    ],
    filterableColumns: [
      "id", "priority", "is_pinned", "publish_at", "expires_at", "created_at",
    ],
    searchableColumns: ["title"],
    defaultSelect: ["id", "title", "priority", "is_pinned", "publish_at"],
    joins: {},
  },

  // ── Timetable Slots ──
  timetable_slots: {
    table: "timetable_slots",
    module: "timetable",
    action: "view",
    scopeColumn: "school_id",
    primaryKey: "slot_id",
    readableColumns: [
      "slot_id", "class_id", "learning_area_id", "teacher_id",
      "academic_year_id", "term_id", "day_of_week", "start_time",
      "end_time", "room", "is_active",
    ],
    filterableColumns: [
      "class_id", "learning_area_id", "teacher_id", "academic_year_id",
      "term_id", "day_of_week", "is_active",
    ],
    searchableColumns: [],
    defaultSelect: ["slot_id", "class_id", "learning_area_id", "teacher_id", "day_of_week", "start_time", "end_time"],
    joins: {},
  },

  // ── Disciplinary Records ──
  disciplinary_records: {
    table: "disciplinary_records",
    module: "students",
    action: "view",
    scopeColumn: "school_id",
    primaryKey: "id",
    readableColumns: [
      "id", "student_id", "incident_date", "incident_type", "severity",
      "description", "action_taken", "status", "location",
      "parent_notified", "created_at",
    ],
    filterableColumns: [
      "student_id", "incident_type", "severity", "status", "incident_date",
    ],
    searchableColumns: [],
    defaultSelect: ["id", "student_id", "incident_date", "incident_type", "severity", "status"],
    sensitiveColumns: ["description", "action_taken"],
    joins: {},
  },

  // ── Special Needs ──
  special_needs: {
    table: "special_needs",
    module: "special_needs",
    action: "view",
    scopeColumn: "school_id",
    primaryKey: "special_needs_id",
    readableColumns: [
      "special_needs_id", "student_id", "needs_type", "description",
      "accommodations", "is_active", "created_at",
    ],
    filterableColumns: [
      "student_id", "needs_type", "is_active",
    ],
    searchableColumns: [],
    defaultSelect: ["special_needs_id", "student_id", "needs_type", "is_active"],
    sensitiveColumns: ["description"],
    joins: {},
  },

  // ── Teacher Subjects ──
  teacher_subjects: {
    table: "teacher_subjects",
    module: "academics",
    action: "view",
    scopeColumn: "school_id",
    primaryKey: "id",
    readableColumns: [
      "id", "teacher_id", "learning_area_id", "class_id",
      "academic_year_id", "term_id", "is_active", "created_at",
    ],
    filterableColumns: [
      "teacher_id", "learning_area_id", "class_id", "academic_year_id", "term_id", "is_active",
    ],
    searchableColumns: [],
    defaultSelect: ["id", "teacher_id", "learning_area_id", "class_id", "is_active"],
    joins: {},
  },

  // ── Academic Years ──
  academic_years: {
    table: "academic_years",
    module: "settings",
    action: "view",
    scopeColumn: "school_id",
    primaryKey: "id",
    readableColumns: [
      "id", "year", "start_date", "end_date", "is_active", "created_at",
    ],
    filterableColumns: [
      "id", "year", "is_active", "start_date", "end_date",
    ],
    searchableColumns: ["year"],
    defaultSelect: ["id", "year", "is_active", "start_date", "end_date"],
    joins: {},
  },

  // ── Terms ──
  terms: {
    table: "terms",
    module: "settings",
    action: "view",
    scopeColumn: "school_id",
    primaryKey: "id",
    readableColumns: [
      "id", "academic_year_id", "name", "start_date", "end_date", "is_active", "created_at",
    ],
    filterableColumns: [
      "id", "academic_year_id", "name", "is_active", "start_date", "end_date",
    ],
    searchableColumns: ["name"],
    defaultSelect: ["id", "academic_year_id", "name", "is_active", "start_date", "end_date"],
    joins: {},
  },
};

export function getDataCatalog(): Record<string, DataCatalogEntity> {
  return DATA_CATALOG;
}

export function getEntity(name: string): DataCatalogEntity | undefined {
  return DATA_CATALOG[name];
}

export function entityExists(name: string): boolean {
  return name in DATA_CATALOG;
}
