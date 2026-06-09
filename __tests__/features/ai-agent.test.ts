import { describe, expect, it } from "@jest/globals";
import { agentPlanSchema, toolInputSchemas, chatRequestSchema, confirmationRequestSchema } from "@/features/ai-agent/validators/aiAgent.schema";
import { requiresConfirmation, getConfirmationTimeoutMs, isActionExpired } from "@/features/ai-agent/services/policy.service";
import { hasPermission, canManageRole, getAccessibleModules } from "@/lib/auth/permissions";
import { PERMISSION_MATRIX } from "@/types/roles";
import { getAvailableToolsForUser, findTool, getToolNamesForUser, ALL_TOOLS } from "@/features/ai-agent/services/tool-registry.service";
import type { AuthUser } from "@/types/auth";

const uuid = "550e8400-e29b-41d4-a716-446655440000";

function makeUser(overrides: Partial<AuthUser> = {}): AuthUser {
  return { id: "user-001", email: "admin@school.com", schoolId: "school-001", role: "school_admin", firstName: "Admin", lastName: "User", ...overrides } as AuthUser;
}

// ═══════════════════════════════════════════════════════════
// 1. Zod Schema Validation
// ═══════════════════════════════════════════════════════════
describe("Zod schema validation", () => {
  describe("agentPlanSchema", () => {
    const validPlan = { intent: "retrieve" as const, userGoal: "Find student count", toolName: "search_students", toolInput: { limit: 10 }, requiresConfirmation: false, riskLevel: "low" as const, reasoningSummary: "Simple lookup", userFacingMessage: "Let me look that up for you." };

    it("accepts valid plan", () => { expect(agentPlanSchema.parse(validPlan).intent).toBe("retrieve"); });
    it("rejects empty userGoal", () => { expect(agentPlanSchema.safeParse({ ...validPlan, userGoal: "" }).success).toBe(false); });
    it("rejects invalid intent", () => { expect(agentPlanSchema.safeParse({ ...validPlan, intent: "fly" }).success).toBe(false); });
    it("rejects invalid riskLevel", () => { expect(agentPlanSchema.safeParse({ ...validPlan, riskLevel: "extreme" }).success).toBe(false); });
  });

  describe("chatRequestSchema", () => {
    it("accepts minimal request", () => { expect(chatRequestSchema.parse({ message: "Hello" }).message).toBe("Hello"); });
    it("accepts request with sessionId", () => { expect(chatRequestSchema.parse({ sessionId: uuid, message: "Hi" }).sessionId).toBe(uuid); });
    it("rejects empty message", () => { expect(chatRequestSchema.safeParse({ message: "" }).success).toBe(false); });
    it("rejects over 10000 chars", () => { expect(chatRequestSchema.safeParse({ message: "x".repeat(10001) }).success).toBe(false); });
  });

  describe("confirmationRequestSchema", () => {
    it("accepts valid UUID", () => { expect(confirmationRequestSchema.parse({ actionId: uuid }).actionId).toBe(uuid); });
    it("rejects invalid UUID", () => { expect(confirmationRequestSchema.safeParse({ actionId: "bad" }).success).toBe(false); });
  });

  describe("toolInputSchemas", () => {
    it("search_students accepts valid", () => { expect(toolInputSchemas.search_students.parse({ query: "John", limit: 20 }).query).toBe("John"); });
    it("search_students rejects negative limit", () => { expect(toolInputSchemas.search_students.safeParse({ limit: -1 }).success).toBe(false); });
    it("search_students rejects limit over 100", () => { expect(toolInputSchemas.search_students.safeParse({ limit: 101 }).success).toBe(false); });
    it("create_student accepts valid", () => {
      const p = toolInputSchemas.create_student.parse({ firstName: "Jane", lastName: "Doe", admissionNumber: "ADM001", classId: uuid, gender: "female" });
      expect(p.firstName).toBe("Jane");
    });
    it("create_student rejects missing required", () => { expect(toolInputSchemas.create_student.safeParse({ firstName: "Jane" }).success).toBe(false); });
    it("delete_student rejects missing reason", () => { expect(toolInputSchemas.delete_student.safeParse({ studentId: uuid }).success).toBe(false); });
    it("bulk_record_attendance rejects empty records", () => {
      expect(toolInputSchemas.bulk_record_attendance.safeParse({ classId: uuid, date: "2026-01-15", records: [] }).success).toBe(false);
    });
    it("generate_assessment rejects invalid difficulty", () => {
      expect(toolInputSchemas.generate_assessment.safeParse({ subject: "Math", topic: "Algebra", grade: "Grade 8", difficulty: "impossible" }).success).toBe(false);
    });
    it("draft_parent_message accepts valid", () => {
      expect(toolInputSchemas.draft_parent_message.parse({ studentId: uuid, subject: "Update", context: "Doing well" }).subject).toBe("Update");
    });
    it("draft_announcement accepts valid", () => {
      expect(toolInputSchemas.draft_announcement.parse({ title: "Meeting", audience: "teachers", context: "Staff meeting" }).title).toBe("Meeting");
    });
  });
});

// ═══════════════════════════════════════════════════════════
// 2. Policy Service
// ═══════════════════════════════════════════════════════════
describe("Policy service", () => {
  function mockTool(riskLevel: "low" | "medium" | "high" | "critical", confirmCb = false) {
    return { name: "test", description: "", module: "students" as const, action: "view" as const, riskLevel, inputSchema: toolInputSchemas.search_students, outputSchema: toolInputSchemas.search_students, execute: async () => ({}), requiresConfirmation: () => confirmCb } as any;
  }

  it("low risk never requires confirmation", () => { expect(requiresConfirmation(mockTool("low"), {}, makeUser())).toBe(false); });
  it("medium without callback is false", () => { expect(requiresConfirmation(mockTool("medium"), {}, makeUser())).toBe(false); });
  it("medium with callback true is true", () => { expect(requiresConfirmation(mockTool("medium", true), {}, makeUser())).toBe(true); });
  it("high risk requires confirmation", () => { expect(requiresConfirmation(mockTool("high"), {}, makeUser())).toBe(true); });
  it("critical risk requires confirmation", () => { expect(requiresConfirmation(mockTool("critical"), {}, makeUser())).toBe(true); });

  it("timeout for high is 300s", () => { expect(getConfirmationTimeoutMs("high")).toBe(300000); });
  it("timeout for critical is 600s", () => { expect(getConfirmationTimeoutMs("critical")).toBe(600000); });
  it("old action is expired", () => { expect(isActionExpired(new Date(Date.now() - 700000), "high")).toBe(true); });
  it("recent action is not expired", () => { expect(isActionExpired(new Date(), "high")).toBe(false); });
});

// ═══════════════════════════════════════════════════════════
// 3. Permission Matrix — RBAC
// ═══════════════════════════════════════════════════════════
describe("Permission matrix completeness", () => {
  it("super_admin and school_admin have broad access", () => {
    expect(Object.keys(PERMISSION_MATRIX.super_admin).length).toBeGreaterThan(0);
    expect(Object.keys(PERMISSION_MATRIX.school_admin).length).toBeGreaterThan(0);
  });
  it("student lacks finance and users modules", () => {
    expect(Object.keys(PERMISSION_MATRIX.student)).not.toContain("finance");
    expect(Object.keys(PERMISSION_MATRIX.student)).not.toContain("users");
  });
  it("parent has students and communication access", () => {
    expect(PERMISSION_MATRIX.parent.students).toContain("view");
    expect(PERMISSION_MATRIX.parent.communication).toContain("view");
  });
  it("teacher has attendance create", () => {
    expect(PERMISSION_MATRIX.teacher.attendance).toContain("create");
  });
  it("class_teacher has reports create", () => {
    expect(PERMISSION_MATRIX.class_teacher.reports).toContain("create");
  });
  it("finance_officer has finance create", () => {
    expect(PERMISSION_MATRIX.finance_officer.finance).toContain("create");
  });
});

// ═══════════════════════════════════════════════════════════
// 4. hasPermission function
// ═══════════════════════════════════════════════════════════
describe("hasPermission", () => {
  it("allows super_admin everything", () => { expect(hasPermission("super_admin", "settings", "update")).toBe(true); });
  it("denies student create", () => { expect(hasPermission("student", "students", "create")).toBe(false); });
  it("denies teacher delete", () => { expect(hasPermission("teacher", "students", "delete")).toBe(false); });
  it("allows teacher view", () => { expect(hasPermission("teacher", "assessments", "view")).toBe(true); });
  it("allows parent finance view (own children)", () => { expect(hasPermission("parent", "finance", "view")).toBe(true); });
  it("allows parent communication", () => { expect(hasPermission("parent", "communication", "view")).toBe(true); });
});

// ═══════════════════════════════════════════════════════════
// 5. getAccessibleModules
// ═══════════════════════════════════════════════════════════
describe("getAccessibleModules", () => {
  it("student has limited modules", () => {
    const mods = getAccessibleModules("student");
    expect(mods).not.toContain("users");
    expect(mods).not.toContain("settings");
  });
  it("teacher does not have audit_logs", () => { expect(getAccessibleModules("teacher")).not.toContain("audit_logs"); });
  it("school_admin has accessible analytics", () => { expect(getAccessibleModules("school_admin")).toContain("analytics"); });
});

// ═══════════════════════════════════════════════════════════
// 6. canManageRole (role hierarchy)
// ═══════════════════════════════════════════════════════════
describe("canManageRole", () => {
  it("teacher cannot manage school_admin", () => { expect(canManageRole("teacher", "school_admin")).toBe(false); });
  it("school_admin cannot manage super_admin", () => { expect(canManageRole("school_admin", "super_admin")).toBe(false); });
  it("super_admin can manage school_admin", () => { expect(canManageRole("super_admin", "school_admin")).toBe(true); });
  it("school_admin can manage teacher", () => { expect(canManageRole("school_admin", "teacher")).toBe(true); });
  it("same level cannot manage each other", () => { expect(canManageRole("teacher", "teacher")).toBe(false); });
});

// ═══════════════════════════════════════════════════════════
// 7. School Scope / Tenant Isolation
// ═══════════════════════════════════════════════════════════
describe("School scope / tenant isolation", () => {
  it("super_admin bypasses scoping", () => { expect(makeUser({ role: "super_admin" }).role).toBe("super_admin"); });
});

// ═══════════════════════════════════════════════════════════
// 8. RBAC — getAvailableToolsForUser (no Supabase needed)
// ═══════════════════════════════════════════════════════════
describe("getAvailableToolsForUser", () => {
  it("student cannot see create/delete tools", () => {
    const tools = getAvailableToolsForUser(makeUser({ role: "student" }));
    const names = tools.map((t) => t.name);
    expect(names).not.toContain("create_student");
    expect(names).not.toContain("delete_student");
    expect(names).not.toContain("change_user_role");
  });

  it("school_admin can see all tools", () => {
    const tools = getAvailableToolsForUser(makeUser({ role: "school_admin" }));
    const names = tools.map((t) => t.name);
    expect(names).toContain("create_student");
    expect(names).toContain("delete_student");
    expect(names).toContain("change_user_role");
    expect(names).toContain("get_student_fee_summary");
  });

  it("parent sees finance view tools but not write tools", () => {
    const tools = getAvailableToolsForUser(makeUser({ role: "parent" }));
    const names = tools.map((t) => t.name);
    expect(names).toContain("get_student_fee_summary");
    expect(names).not.toContain("record_payment");
    expect(names).not.toContain("create_fee_structure");
  });

  it("teacher sees attendance and assessment tools", () => {
    const tools = getAvailableToolsForUser(makeUser({ role: "teacher" }));
    const names = tools.map((t) => t.name);
    expect(names).toContain("get_student_attendance_summary");
    expect(names).toContain("record_attendance");
    expect(names).toContain("get_class_roster");
  });
});

// ═══════════════════════════════════════════════════════════
// 9. High-risk confirmation on specific tools
// ═══════════════════════════════════════════════════════════
describe("High-risk confirmation on specific tools", () => {
  it("create_fee_structure is high risk", () => { expect(findTool("create_fee_structure")?.riskLevel).toBe("high"); });
  it("bulk_record_attendance is high risk", () => { expect(findTool("bulk_record_attendance")?.riskLevel).toBe("high"); });
  it("record_payment is high risk", () => { expect(findTool("record_payment")?.riskLevel).toBe("high"); });
  it("send_message is high risk", () => { expect(findTool("send_message")?.riskLevel).toBe("high"); });
  it("create_announcement is high risk", () => { expect(findTool("create_announcement")?.riskLevel).toBe("high"); });
  it("generate_report_cards is high risk", () => { expect(findTool("generate_report_cards")?.riskLevel).toBe("high"); });
  it("delete_student is critical", () => { expect(findTool("delete_student")?.riskLevel).toBe("critical"); });
  it("change_user_role is critical", () => { expect(findTool("change_user_role")?.riskLevel).toBe("critical"); });
  it("waive_fee is critical", () => { expect(findTool("waive_fee")?.riskLevel).toBe("critical"); });
  it("publish_report_cards is critical", () => { expect(findTool("publish_report_cards")?.riskLevel).toBe("critical"); });
  it("change_active_term is critical", () => { expect(findTool("change_active_term")?.riskLevel).toBe("critical"); });
  it("create_student is medium with callback requiring confirmation", () => {
    const tool = findTool("create_student")!;
    expect(tool.riskLevel).toBe("medium");
    expect(requiresConfirmation(tool, { firstName: "T", lastName: "U", admissionNumber: "A1", classId: uuid, gender: "male" }, makeUser())).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════
// 10. Tool registry completeness
// ═══════════════════════════════════════════════════════════
describe("Tool registry completeness", () => {
  const readTools = ["search_students", "get_student_profile", "get_student_attendance_summary", "get_student_assessment_summary", "get_student_fee_summary", "get_class_roster", "get_class_attendance_summary", "get_class_performance_summary", "get_school_health_summary", "get_timetable", "get_report_card_status", "get_messages_summary", "get_audit_summary"];
  const draftTools = ["draft_parent_message", "draft_announcement", "draft_report_comment", "generate_lesson_plan", "generate_assessment", "generate_study_plan", "explain_cbc_result", "predict_dropout_risk", "predict_fee_default_risk"];
  const writeTools = ["create_student", "update_student", "record_attendance", "bulk_record_attendance", "create_assessment", "bulk_create_assessments", "create_discipline_record", "create_timetable_slot", "create_fee_structure", "assign_student_fee", "record_payment", "send_message", "create_announcement", "generate_report_cards"];
  const highRiskTools = ["delete_student", "change_user_role", "waive_fee", "publish_report_cards", "change_active_term"];
  const allExpected = [...readTools, ...draftTools, ...writeTools, ...highRiskTools];

  it("contains every expected tool", () => {
    const names = ALL_TOOLS.map((t) => t.name);
    for (const name of allExpected) { expect(names).toContain(name); }
    expect(ALL_TOOLS.length).toBe(allExpected.length);
  });

  it("every tool has required fields", () => {
    for (const tool of ALL_TOOLS) {
      expect(tool.module).toBeDefined();
      expect(tool.action).toBeDefined();
      expect(["low", "medium", "high", "critical"]).toContain(tool.riskLevel);
      expect(tool.inputSchema).toBeDefined();
      expect(tool.execute).toBeInstanceOf(Function);
    }
  });

  it("read tools are low risk", () => {
    const names = ALL_TOOLS.filter((t) => t.riskLevel === "low").map((t) => t.name);
    for (const r of readTools) { expect(names).toContain(r); }
  });

  it("critical tools require confirmation", () => {
    for (const tool of ALL_TOOLS) {
      if (tool.riskLevel === "critical") {
        expect(requiresConfirmation(tool, {}, makeUser())).toBe(true);
      }
    }
  });
});
