// types/roles.ts
// ============================================================
// Central role definitions and permission matrix
// Maps all 13 system roles to their access levels
// Used by middleware, guards, and UI visibility logic
// ============================================================

// ============================================================
// Role Name Constants
// ============================================================
export const ROLES = {
  SUPER_ADMIN: "super_admin",
  SCHOOL_ADMIN: "school_admin",
  PRINCIPAL: "principal",
  DEPUTY_PRINCIPAL: "deputy_principal",
  TEACHER: "teacher",
  CLASS_TEACHER: "class_teacher",
  SUBJECT_TEACHER: "subject_teacher",
  FINANCE_OFFICER: "finance_officer",
  PARENT: "parent",
  STUDENT: "student",
  BURSAR: "bursar",
  LIBRARIAN: "librarian",
  ICT_ADMIN: "ict_admin",
} as const;

export type RoleName = (typeof ROLES)[keyof typeof ROLES];

// ============================================================
// Module Access Definitions
// ============================================================
export const MODULES = {
  DASHBOARD: "dashboard",
  STUDENTS: "students",
  TEACHERS: "teachers",
  CLASSES: "classes",
  ACADEMICS: "academics",
  ASSESSMENTS: "assessments",
  EXAMS: "exams",
  ATTENDANCE: "attendance",
  FINANCE: "finance",
  REPORTS: "reports",
  COMMUNICATION: "communication",
  COMPLIANCE: "compliance",
  SETTINGS: "settings",
  ANALYTICS: "analytics",
  LIBRARY: "library",
  USERS: "users",
  AUDIT_LOGS: "audit_logs",
  TIMETABLE: "timetable",
  SPECIAL_NEEDS: "special_needs",
} as const;

export type ModuleName = (typeof MODULES)[keyof typeof MODULES];

// ============================================================
// Permission Actions
// ============================================================
export const ACTIONS = {
  VIEW: "view",
  CREATE: "create",
  UPDATE: "update",
  DELETE: "delete",
  EXPORT: "export",
  APPROVE: "approve",
  PUBLISH: "publish",
} as const;

export type ActionName = (typeof ACTIONS)[keyof typeof ACTIONS];

// ============================================================
// Permission Matrix Type
// ============================================================
export type PermissionMatrix = {
  [role in RoleName]: {
    [module in ModuleName]?: ActionName[];
  };
};

// ============================================================
// Full Permission Matrix
// Defines exactly what each role can do in each module
// ============================================================
export const PERMISSION_MATRIX: PermissionMatrix = {
  // ─── SUPER ADMIN: Full access to everything ───
  super_admin: {
    dashboard: ["view"],
    students: ["view", "create", "update", "delete", "export"],
    teachers: ["view", "create", "update", "delete", "export"],
    classes: ["view", "create", "update", "delete"],
    academics: ["view", "create", "update", "delete"],
    assessments: ["view", "create", "update", "delete", "export"],
    exams: ["view", "create", "update", "delete", "export"],
    attendance: ["view", "create", "update", "delete", "export"],
    finance: ["view", "create", "update", "delete", "export", "approve"],
    reports: ["view", "create", "update", "export", "publish"],
    communication: ["view", "create", "update", "delete"],
    compliance: ["view", "create", "update", "delete"],
    settings: ["view", "create", "update", "delete"],
    analytics: ["view", "export"],
    library: ["view", "create", "update", "delete"],
    users: ["view", "create", "update", "delete"],
    audit_logs: ["view", "export"],
    timetable: ["view", "create", "update", "delete"],
    special_needs: ["view", "create", "update", "delete", "export"],
  },

  // ─── SCHOOL ADMIN: Full school-level access ───
  school_admin: {
    dashboard: ["view"],
    students: ["view", "create", "update", "delete", "export"],
    teachers: ["view", "create", "update", "delete", "export"],
    classes: ["view", "create", "update", "delete"],
    academics: ["view", "create", "update", "delete"],
    assessments: ["view", "create", "update", "delete", "export"],
    exams: ["view", "create", "update", "delete", "export"],
    attendance: ["view", "create", "update", "export"],
    finance: ["view", "create", "update", "delete", "export", "approve"],
    reports: ["view", "create", "update", "export", "publish"],
    communication: ["view", "create", "update", "delete"],
    compliance: ["view", "create", "update", "delete"],
    settings: ["view", "update"],
    analytics: ["view", "export"],
    library: ["view", "create", "update", "delete"],
    users: ["view", "create", "update", "delete"],
    audit_logs: ["view"],
    timetable: ["view", "create", "update", "delete"],
    special_needs: ["view", "create", "update", "delete", "export"],
  },

  // ─── PRINCIPAL: Academic & administrative oversight ───
  principal: {
    dashboard: ["view"],
    students: ["view", "create", "update", "export"],
    teachers: ["view", "update", "export"],
    classes: ["view", "create", "update"],
    academics: ["view", "create", "update"],
    assessments: ["view", "export"],
    exams: ["view", "create", "update", "export"],
    attendance: ["view", "export"],
    finance: ["view", "export", "approve"],
    reports: ["view", "create", "update", "export", "publish"],
    communication: ["view", "create"],
    compliance: ["view", "create", "update"],
    settings: ["view"],
    analytics: ["view", "export"],
    library: ["view"],
    users: ["view", "create", "update"],
    audit_logs: ["view"],
    timetable: ["view", "create", "update"],
    special_needs: ["view", "create", "update", "delete", "export"],
  },

  // ─── DEPUTY PRINCIPAL ───
  deputy_principal: {
    dashboard: ["view"],
    students: ["view", "create", "update", "export"],
    teachers: ["view", "update"],
    classes: ["view", "create", "update"],
    academics: ["view", "create", "update"],
    assessments: ["view", "export"],
    exams: ["view", "create", "update"],
    attendance: ["view", "create", "update", "export"],
    finance: ["view"],
    reports: ["view", "create", "update", "export"],
    communication: ["view", "create"],
    compliance: ["view", "create", "update"],
    settings: ["view"],
    analytics: ["view"],
    library: ["view"],
    users: ["view"],
    audit_logs: ["view"],
    timetable: ["view", "create", "update"],
    special_needs: ["view", "create", "update", "delete"],
  },

  // ─── TEACHER (General) ───
  teacher: {
    dashboard: ["view"],
    students: ["view"],
    classes: ["view"],
    academics: ["view"],
    assessments: ["view", "create", "update"],
    exams: ["view", "create", "update"],
    attendance: ["view", "create", "update"],
    reports: ["view"],
    communication: ["view", "create"],
    analytics: ["view"],
    special_needs: ["view"],
  },

  // ─── CLASS TEACHER ───
  class_teacher: {
    dashboard: ["view"],
    students: ["view", "update"],
    classes: ["view"],
    academics: ["view"],
    assessments: ["view", "create", "update"],
    exams: ["view", "create", "update"],
    attendance: ["view", "create", "update"],
    reports: ["view", "create", "update"],
    communication: ["view", "create"],
    compliance: ["view"],
    analytics: ["view"],
    special_needs: ["view", "create", "update"],
  },

  // ─── SUBJECT TEACHER ───
  subject_teacher: {
    dashboard: ["view"],
    students: ["view"],
    classes: ["view"],
    academics: ["view"],
    assessments: ["view", "create", "update"],
    exams: ["view", "create", "update"],
    attendance: ["view", "create", "update"],
    reports: ["view"],
    communication: ["view", "create"],
    analytics: ["view"],
    special_needs: ["view"],
  },

  // ─── FINANCE OFFICER ───
  finance_officer: {
    dashboard: ["view"],
    students: ["view"],
    finance: ["view", "create", "update", "delete", "export", "approve"],
    reports: ["view", "export"],
    communication: ["view", "create"],
    analytics: ["view"],
  },

  // ─── BURSAR ───
  bursar: {
    dashboard: ["view"],
    students: ["view"],
    finance: ["view", "create", "update", "export"],
    reports: ["view", "export"],
    communication: ["view", "create"],
  },

  // ─── PARENT ───
  parent: {
    dashboard: ["view"],
    students: ["view"], // Own children only (enforced by RLS)
    assessments: ["view"], // Own children only
    attendance: ["view"], // Own children only
    finance: ["view"], // Own children's fees only
    reports: ["view"], // Own children's report cards
    communication: ["view", "create"],
    compliance: ["view", "update"], // Own consent management
    special_needs: ["view"], // Own children's special needs
  },

  // ─── STUDENT ───
  student: {
    dashboard: ["view"],
    assessments: ["view"], // Own records only
    attendance: ["view"], // Own records only
    reports: ["view"], // Own report cards only
    communication: ["view"],
    library: ["view"],
    special_needs: ["view"], // Own special needs
  },

  // ─── LIBRARIAN ───
  librarian: {
    dashboard: ["view"],
    students: ["view"],
    library: ["view", "create", "update", "delete"],
    communication: ["view", "create"],
  },

  // ─── ICT ADMIN ───
  ict_admin: {
    dashboard: ["view"],
    students: ["view"],
    teachers: ["view"],
    classes: ["view"],
    exams: ["view", "create", "update"],
    settings: ["view", "update"],
    users: ["view", "create", "update"],
    audit_logs: ["view", "export"],
    communication: ["view", "create"],
    special_needs: ["view"],
  },
};

// ============================================================
// Role Hierarchy (for escalation prevention)
// Higher number = higher privilege
// ============================================================
export const ROLE_HIERARCHY: Record<RoleName, number> = {
  super_admin: 100,
  school_admin: 90,
  principal: 80,
  deputy_principal: 70,
  ict_admin: 65,
  finance_officer: 60,
  bursar: 55,
  class_teacher: 50,
  subject_teacher: 45,
  teacher: 40,
  librarian: 35,
  parent: 20,
  student: 10,
};

// ============================================================
// Admin-level roles grouping
// ============================================================
export const ADMIN_ROLES: RoleName[] = [
  "super_admin",
  "school_admin",
  "principal",
  "deputy_principal",
  "ict_admin",
];

export const TEACHING_ROLES: RoleName[] = [
  "teacher",
  "class_teacher",
  "subject_teacher",
];

export const FINANCE_ROLES: RoleName[] = ["finance_officer", "bursar"];
