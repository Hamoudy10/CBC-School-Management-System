import { z } from "zod";

export const agentPlanSchema = z.object({
  intent: z.enum(["answer", "retrieve", "act", "clarify", "refuse"]),
  userGoal: z.string().min(0).max(500),
  toolName: z.string().nullable(),
  toolInput: z.record(z.unknown()).nullable(),
  requiresConfirmation: z.boolean(),
  riskLevel: z.enum(["low", "medium", "high", "critical"]),
  reasoningSummary: z.string().min(0).max(1000),
  userFacingMessage: z.string().min(1).max(2000),
});

export const chatRequestSchema = z.object({
  sessionId: z.string().uuid().optional(),
  message: z.string().min(1).max(10000),
  pageContext: z
    .object({
      route: z.string().optional(),
      module: z.string().optional(),
      selectedRecordId: z.string().optional(),
    })
    .optional(),
  mode: z.enum(["assist", "act"]).optional(),
});

export const confirmationRequestSchema = z.object({
  actionId: z.string().uuid(),
  confirmationText: z.string().max(500).optional(),
});

export const cancelRequestSchema = z.object({
  actionId: z.string().uuid(),
});

export const createSessionSchema = z.object({
  title: z.string().max(200).optional(),
  mode: z.enum(["assist", "act"]).optional(),
});

export const updateSessionSchema = z.object({
  title: z.string().max(200).optional(),
  status: z.enum(["active", "completed", "cancelled"]).optional(),
});

export const toolInputSchemas = {
  search_students: z.object({
    query: z.string().optional(),
    classId: z.string().uuid().optional(),
    status: z.string().optional(),
    limit: z.number().int().min(1).max(100).optional(),
  }),

  get_student_profile: z.object({
    studentId: z.string().uuid(),
  }),

  get_student_attendance_summary: z.object({
    studentId: z.string().uuid(),
    termId: z.string().uuid().optional(),
    academicYearId: z.string().uuid().optional(),
  }),

  get_student_assessment_summary: z.object({
    studentId: z.string().uuid(),
    academicYearId: z.string().uuid().optional(),
    termId: z.string().uuid().optional(),
  }),

  get_student_fee_summary: z.object({
    studentId: z.string().uuid(),
  }),

  get_class_roster: z.object({
    classId: z.string().uuid(),
  }),

  get_class_attendance_summary: z.object({
    classId: z.string().uuid(),
    termId: z.string().uuid().optional(),
    academicYearId: z.string().uuid().optional(),
  }),

  get_class_performance_summary: z.object({
    classId: z.string().uuid(),
    academicYearId: z.string().uuid().optional(),
    termId: z.string().uuid().optional(),
  }),

  get_school_health_summary: z.object({
    academicYearId: z.string().uuid().optional(),
  }),

  get_staff_summary: z.object({
    status: z.enum(["active", "inactive", "suspended", "archived"]).optional(),
    teachingOnly: z.boolean().optional(),
  }),

  get_timetable: z.object({
    classId: z.string().uuid().optional(),
    teacherId: z.string().uuid().optional(),
    dayOfWeek: z.number().int().min(0).max(6).optional(),
  }),

  get_report_card_status: z.object({
    classId: z.string().uuid().optional(),
    studentId: z.string().uuid().optional(),
    academicYearId: z.string().uuid().optional(),
    termId: z.string().uuid().optional(),
  }),

  get_messages_summary: z.object({
    limit: z.number().int().min(1).max(100).optional(),
    unreadOnly: z.boolean().optional(),
  }),

  get_audit_summary: z.object({
    limit: z.number().int().min(1).max(100).optional(),
    module: z.string().optional(),
  }),

  draft_parent_message: z.object({
    studentId: z.string().uuid(),
    subject: z.string().min(1).max(200),
    context: z.string().min(1).max(2000),
    tone: z.enum(["formal", "friendly", "urgent"]).optional(),
  }),

  draft_announcement: z.object({
    title: z.string().min(1).max(200),
    audience: z.enum(["all", "teachers", "parents", "students", "staff"]),
    context: z.string().min(1).max(2000),
  }),

  draft_report_comment: z.object({
    studentId: z.string().uuid(),
    subject: z.string().min(1).max(200),
    performance: z.enum(["exceeding", "meeting", "approaching", "below"]),
    strengths: z.string().max(500).optional(),
    areasToImprove: z.string().max(500).optional(),
  }),

  generate_lesson_plan: z.object({
    subject: z.string().min(1).max(200),
    topic: z.string().min(1).max(200),
    grade: z.string().min(1).max(50),
    duration: z.string().optional(),
    learningAreaId: z.string().uuid().optional(),
  }),

  generate_assessment: z.object({
    subject: z.string().min(1).max(200),
    topic: z.string().min(1).max(200),
    grade: z.string().min(1).max(50),
    questionCount: z.number().int().min(1).max(50).optional(),
    difficulty: z.enum(["easy", "medium", "hard"]).optional(),
  }),

  generate_study_plan: z.object({
    studentId: z.string().uuid(),
    subjects: z.array(z.string()).min(1).max(10),
    durationDays: z.number().int().min(1).max(90).optional(),
    focusArea: z.string().optional(),
  }),

  explain_cbc_result: z.object({
    studentId: z.string().uuid(),
    subject: z.string().min(1).max(200),
    score: z.number().min(0).max(100),
    grade: z.string().min(1).max(10),
  }),

  predict_dropout_risk: z.object({
    studentId: z.string().uuid(),
  }),

  predict_fee_default_risk: z.object({
    studentId: z.string().uuid().optional(),
    classId: z.string().uuid().optional(),
  }),

  create_student: z.object({
    firstName: z.string().min(1).max(100),
    lastName: z.string().min(1).max(100),
    admissionNumber: z.string().min(1).max(50),
    classId: z.string().uuid(),
    gender: z.enum(["male", "female"]),
    dateOfBirth: z.string().optional(),
  }),

  update_student: z.object({
    studentId: z.string().uuid(),
    firstName: z.string().max(100).optional(),
    lastName: z.string().max(100).optional(),
    classId: z.string().uuid().optional(),
    status: z.string().optional(),
  }),

  record_attendance: z.object({
    classId: z.string().uuid(),
    date: z.string(),
    studentId: z.string().uuid(),
    status: z.enum(["present", "absent", "late", "excused"]),
    remarks: z.string().max(500).optional(),
  }),

  bulk_record_attendance: z.object({
    classId: z.string().uuid(),
    date: z.string(),
    records: z.array(
      z.object({
        studentId: z.string().uuid(),
        status: z.enum(["present", "absent", "late", "excused"]),
        remarks: z.string().max(500).optional(),
      }),
    ).min(1).max(100),
  }),

  create_assessment: z.object({
    studentId: z.string().uuid(),
    subject: z.string().min(1).max(200),
    score: z.number().min(0).max(100),
    termId: z.string().uuid(),
    academicYearId: z.string().uuid(),
    remarks: z.string().max(1000).optional(),
  }),

  bulk_create_assessments: z.object({
    classId: z.string().uuid(),
    subject: z.string().min(1).max(200),
    termId: z.string().uuid(),
    academicYearId: z.string().uuid(),
    scores: z.array(
      z.object({
        studentId: z.string().uuid(),
        score: z.number().min(0).max(100),
        remarks: z.string().max(1000).optional(),
      }),
    ).min(1).max(100),
  }),

  create_discipline_record: z.object({
    studentId: z.string().uuid(),
    incidentType: z.string().min(1).max(200),
    description: z.string().min(1).max(2000),
    date: z.string(),
    action: z.string().max(1000).optional(),
  }),

  create_timetable_slot: z.object({
    classId: z.string().uuid(),
    subject: z.string().min(1).max(200),
    dayOfWeek: z.number().int().min(0).max(6),
    startTime: z.string(),
    endTime: z.string(),
    teacherId: z.string().uuid().optional(),
  }),

  create_fee_structure: z.object({
    classId: z.string().uuid(),
    academicYearId: z.string().uuid(),
    termId: z.string().uuid(),
    amount: z.number().positive(),
    description: z.string().max(500).optional(),
  }),

  assign_student_fee: z.object({
    studentId: z.string().uuid(),
    feeStructureId: z.string().uuid(),
    amount: z.number().positive().optional(),
    dueDate: z.string().optional(),
  }),

  record_payment: z.object({
    studentId: z.string().uuid(),
    amount: z.number().positive(),
    paymentMethod: z.string().min(1).max(50),
    transactionRef: z.string().max(200).optional(),
    termId: z.string().uuid(),
    academicYearId: z.string().uuid(),
    notes: z.string().max(500).optional(),
  }),

  send_message: z.object({
    recipientId: z.string().uuid(),
    recipientType: z.enum(["parent", "teacher", "student", "staff"]),
    subject: z.string().min(1).max(200),
    body: z.string().min(1).max(5000),
    priority: z.enum(["normal", "high", "urgent"]).optional(),
  }),

  create_announcement: z.object({
    title: z.string().min(1).max(200),
    body: z.string().min(1).max(5000),
    audience: z.enum(["all", "teachers", "parents", "students", "staff"]),
    priority: z.enum(["normal", "high", "urgent"]).optional(),
  }),

  generate_report_cards: z.object({
    classId: z.string().uuid(),
    academicYearId: z.string().uuid(),
    termId: z.string().uuid(),
    studentIds: z.array(z.string().uuid()).min(1).max(100).optional(),
  }),

  delete_student: z.object({
    studentId: z.string().uuid(),
    reason: z.string().min(1).max(500),
  }),

  change_user_role: z.object({
    userId: z.string().uuid(),
    newRole: z.string().min(1).max(50),
    reason: z.string().min(1).max(500),
  }),

  waive_fee: z.object({
    studentId: z.string().uuid(),
    amount: z.number().positive(),
    reason: z.string().min(1).max(500),
    termId: z.string().uuid(),
    academicYearId: z.string().uuid(),
  }),

  publish_report_cards: z.object({
    classId: z.string().uuid(),
    academicYearId: z.string().uuid(),
    termId: z.string().uuid(),
  }),

  change_active_term: z.object({
    academicYearId: z.string().uuid(),
    termId: z.string().uuid(),
    reason: z.string().min(1).max(500),
  }),

  query_school_data: z.object({
    entity: z.string().min(1).max(50),
    operation: z.enum(["count", "list", "summary", "exists"]),
    select: z.array(z.string().min(1).max(100)).min(1).max(20).optional(),
    filters: z.array(
      z.object({
        field: z.string().min(1).max(100),
        operator: z.enum(["eq", "neq", "in", "gte", "lte", "gt", "lt", "contains", "ilike", "is_null", "not_null"]),
        value: z.any().optional(),
      }),
    ).max(20).optional(),
    search: z.string().max(200).optional(),
    searchFields: z.array(z.string().min(1).max(100)).max(5).optional(),
    groupBy: z.array(z.string().min(1).max(100)).max(5).optional(),
    orderBy: z.string().max(100).optional(),
    orderDirection: z.enum(["asc", "desc"]).optional(),
    limit: z.number().int().min(1).max(500).optional(),
    offset: z.number().int().min(0).optional(),
  }),
} as const;

export const querySchoolDataSchema = z.object({
  entity: z.string().min(1).max(50),
  operation: z.enum(["count", "list", "summary", "exists"]),
  select: z.array(z.string().min(1).max(100)).min(1).max(20).optional(),
  filters: z.array(
    z.object({
      field: z.string().min(1).max(100),
      operator: z.enum(["eq", "neq", "in", "gte", "lte", "gt", "lt", "contains", "ilike", "is_null", "not_null"]),
      value: z.any().optional(),
    }),
  ).max(20).optional(),
  search: z.string().max(200).optional(),
  searchFields: z.array(z.string().min(1).max(100)).max(5).optional(),
  groupBy: z.array(z.string().min(1).max(100)).max(5).optional(),
  orderBy: z.string().max(100).optional(),
  orderDirection: z.enum(["asc", "desc"]).optional(),
  limit: z.number().int().min(1).max(500).optional(),
  offset: z.number().int().min(0).optional(),
});

export type ToolName = keyof typeof toolInputSchemas;
