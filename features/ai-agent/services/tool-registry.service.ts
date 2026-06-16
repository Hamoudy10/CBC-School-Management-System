import { createSupabaseServerClient } from "@/lib/supabase/server";
import { hasPermission, canManageRole } from "@/lib/auth/permissions";
import { PERMISSION_MATRIX } from "@/types/roles";
import type { AuthUser } from "@/types/auth";
import type { AgentTool } from "@/features/ai-agent/types";
import { toolInputSchemas } from "@/features/ai-agent/validators/aiAgent.schema";
import { canAccessStudent, sanitizeForAgent } from "./context-builder.service";
import { getProvider } from "@/lib/ai/providers";
import { executeSafeQuery } from "./safe-query-executor.service";
import type { QuerySchoolDataOutput } from "./safe-query-executor.service";
import { z } from "zod";

const TEACHING_POSITIONS = new Set([
  "principal", "deputy_principal", "class_teacher", "subject_teacher",
]);

function makeTool<TInput extends z.ZodType<any>, TOutput extends z.ZodType<any>>(
  name: string,
  description: string,
  module: "students" | "teachers" | "attendance" | "assessments" | "finance" | "academics" | "reports" | "communication" | "timetable" | "analytics" | "audit_logs" | "users" | "settings" | "library" | "exams",
  action: "view" | "create" | "update" | "delete" | "approve" | "publish",
  riskLevel: "low" | "medium" | "high" | "critical",
  inputSchema: TInput,
  outputSchema: TOutput,
  execute: (input: z.infer<TInput>, context: { user: AuthUser; schoolId: string; sessionId: string; requestId: string }) => Promise<z.infer<TOutput>>,
  requiresConfirmation?: (input: z.infer<TInput>, user: AuthUser) => boolean,
): AgentTool<z.infer<TInput>, z.infer<TOutput>> {
  return {
    name,
    description,
    module,
    action,
    riskLevel,
    inputSchema,
    outputSchema,
    requiresConfirmation: requiresConfirmation ?? (() => false),
    execute: execute as any,
  };
}

// ─── Tool Output Schemas ───
const anyOutput = z.record(z.unknown()).or(z.array(z.record(z.unknown()))).or(z.string());
const summaryOutput = z.object({
  summary: z.string(),
  details: z.any().optional(),
  warnings: z.array(z.string()).optional(),
});

const voidOutput = z.object({ success: z.boolean(), message: z.string() });

const queryOutput = z.object({
  summary: z.string(),
  rows: z.array(z.record(z.unknown())),
  count: z.number(),
  totalCount: z.number().optional(),
  grouped: z.record(z.number()).optional(),
  appliedFilters: z.array(z.object({ field: z.string(), operator: z.string(), value: z.any().optional() })),
  warnings: z.array(z.string()),
  executionMs: z.number(),
});

// ═══════════════════════════════════════════
// PHASE B: READ-ONLY TOOLS
// ═══════════════════════════════════════════
// PHASE B: READ-ONLY TOOLS
// ═══════════════════════════════════════════

const search_students = makeTool(
  "search_students",
  "Search for students by name, class, or status",
  "students",
  "view",
  "low",
  toolInputSchemas.search_students,
  summaryOutput,
  async (input, { user, schoolId }) => {
    const supabase = await createSupabaseServerClient();
    let query = supabase.from("students").select("*, classes(name)").eq("school_id", schoolId).limit(input.limit ?? 20);
    if (input.classId) query = query.eq("class_id", input.classId);
    if (input.status) query = query.eq("status", input.status);
    if (input.query) {
      query = query.or(`first_name.ilike.%${input.query}%,last_name.ilike.%${input.query}%,admission_number.ilike.%${input.query}%`);
    }
    const { data } = await query;
    const safe = (data ?? []).map((s: any) => sanitizeForAgent(s));
    return { summary: `Found ${safe.length} student(s)`, details: safe };
  },
);

const get_student_profile = makeTool(
  "get_student_profile",
  "Get detailed profile for a specific student",
  "students",
  "view",
  "low",
  toolInputSchemas.get_student_profile,
  summaryOutput,
  async (input, { user, schoolId }) => {
    const access = await canAccessStudent(user, input.studentId);
    if (!access) throw new Error("You do not have permission to view this student's profile");
    const supabase = await createSupabaseServerClient();
    const { data } = await supabase.from("students").select("*, classes(name)").eq("student_id", input.studentId).eq("school_id", schoolId).maybeSingle();
    if (!data) throw new Error("Student not found");
    return { summary: `Profile for ${data.first_name} ${data.last_name}`, details: sanitizeForAgent(data) };
  },
);

const get_student_attendance_summary = makeTool(
  "get_student_attendance_summary",
  "Get attendance summary for a student",
  "attendance",
  "view",
  "low",
  toolInputSchemas.get_student_attendance_summary,
  summaryOutput,
  async (input, { user, schoolId }) => {
    const access = await canAccessStudent(user, input.studentId);
    if (!access) throw new Error("Access denied");
    const supabase = await createSupabaseServerClient();
    let query = supabase.from("attendance").select("*").eq("student_id", input.studentId).eq("school_id", schoolId);
    if (input.termId) query = query.eq("term_id", input.termId);
    if (input.academicYearId) query = query.eq("academic_year_id", input.academicYearId);
    const { data } = await query;
    const records = data ?? [];
    const present = records.filter((r: any) => r.status === "present").length;
    const absent = records.filter((r: any) => r.status === "absent").length;
    const late = records.filter((r: any) => r.status === "late").length;
    const total = records.length;
    return {
      summary: `Attendance: ${present}/${total} present (${total ? Math.round(present / total * 100) : 0}%), ${absent} absent, ${late} late`,
      details: { total, present, absent, late, records: records.slice(0, 50) },
    };
  },
);

const get_student_assessment_summary = makeTool(
  "get_student_assessment_summary",
  "Get assessment/grade summary for a student",
  "assessments",
  "view",
  "low",
  toolInputSchemas.get_student_assessment_summary,
  summaryOutput,
  async (input, { user, schoolId }) => {
    const access = await canAccessStudent(user, input.studentId);
    if (!access) throw new Error("Access denied");
    const supabase = await createSupabaseServerClient();
    let query = supabase.from("assessments").select("*, subjects(name)").eq("student_id", input.studentId).eq("school_id", schoolId);
    if (input.termId) query = query.eq("term_id", input.termId);
    if (input.academicYearId) query = query.eq("academic_year_id", input.academicYearId);
    const { data } = await query;
    const results = data ?? [];
    const avg = results.length ? Math.round(results.reduce((s: number, r: any) => s + (r.score ?? 0), 0) / results.length) : 0;
    return { summary: `${results.length} assessment(s), average: ${avg}%`, details: results.slice(0, 50) };
  },
);

const get_student_fee_summary = makeTool(
  "get_student_fee_summary",
  "Get fee/payment summary for a student",
  "finance",
  "view",
  "low",
  toolInputSchemas.get_student_fee_summary,
  summaryOutput,
  async (input, { user, schoolId }) => {
    if (!hasPermission(user.role, "finance", "view")) throw new Error("You do not have finance access");
    const access = await canAccessStudent(user, input.studentId);
    if (!access) throw new Error("Access denied");
    const supabase = await createSupabaseServerClient();
    const [fees, payments] = await Promise.all([
      supabase.from("student_fees").select("*, fee_structures(amount, description)").eq("student_id", input.studentId).eq("school_id", schoolId),
      supabase.from("payments").select("*").eq("student_id", input.studentId).eq("school_id", schoolId),
    ]);
    const totalFee = (fees.data ?? []).reduce((s: number, f: any) => s + (f.fee_structures?.amount ?? f.amount ?? 0), 0);
    const totalPaid = (payments.data ?? []).reduce((s: number, p: any) => s + (p.amount ?? 0), 0);
    return {
      summary: `Total fees: KES ${totalFee.toLocaleString()}, Paid: KES ${totalPaid.toLocaleString()}, Balance: KES ${(totalFee - totalPaid).toLocaleString()}`,
      details: { totalFee, totalPaid, balance: totalFee - totalPaid, paymentCount: (payments.data ?? []).length },
    };
  },
);

const get_class_roster = makeTool(
  "get_class_roster",
  "Get list of students in a class",
  "students",
  "view",
  "low",
  toolInputSchemas.get_class_roster,
  summaryOutput,
  async (input, { schoolId }) => {
    const supabase = await createSupabaseServerClient();
    const { data } = await supabase.from("students").select("student_id, first_name, last_name, admission_number, gender, status").eq("class_id", input.classId).eq("school_id", schoolId).order("first_name");
    return { summary: `${(data ?? []).length} student(s) in class`, details: sanitizeForAgent(data ?? []) };
  },
);

const get_class_attendance_summary = makeTool(
  "get_class_attendance_summary",
  "Get attendance summary for an entire class",
  "attendance",
  "view",
  "low",
  toolInputSchemas.get_class_attendance_summary,
  summaryOutput,
  async (input, { schoolId }) => {
    const supabase = await createSupabaseServerClient();
    let query = supabase.from("attendance").select("*, students(first_name, last_name)").eq("school_id", schoolId);
    if (input.academicYearId) query = query.eq("academic_year_id", input.academicYearId);
    if (input.termId) query = query.eq("term_id", input.termId);
    const { data } = await query;
    const classRecords = (data ?? []).filter((r: any) => r.students?.student_id);
    return { summary: `${classRecords.length} attendance record(s)`, details: classRecords.slice(0, 100) };
  },
);

const get_class_performance_summary = makeTool(
  "get_class_performance_summary",
  "Get academic performance summary for a class",
  "assessments",
  "view",
  "low",
  toolInputSchemas.get_class_performance_summary,
  summaryOutput,
  async (input, { schoolId }) => {
    const supabase = await createSupabaseServerClient();
    let query = supabase.from("assessments").select("*, students(first_name, last_name, class_id)").eq("school_id", schoolId);
    if (input.academicYearId) query = query.eq("academic_year_id", input.academicYearId);
    if (input.termId) query = query.eq("term_id", input.termId);
    const { data } = await query;
    const results = data ?? [];
    const avg = results.length ? Math.round(results.reduce((s: number, r: any) => s + (r.score ?? 0), 0) / results.length) : 0;
    return { summary: `${results.length} assessment result(s), class average: ${avg}%`, details: results.slice(0, 100) };
  },
);

const get_school_health_summary = makeTool(
  "get_school_health_summary",
  "Get overall school health metrics",
  "analytics",
  "view",
  "low",
  toolInputSchemas.get_school_health_summary,
  summaryOutput,
  async (_, { schoolId }) => {
    const supabase = await createSupabaseServerClient();
    const [students, teachers, classes, attendance] = await Promise.all([
      supabase.from("students").select("student_id, status").eq("school_id", schoolId),
      supabase.from("staff").select("staff_id, status, position").eq("school_id", schoolId),
      supabase.from("classes").select("class_id").eq("school_id", schoolId),
      supabase.from("attendance").select("status").eq("school_id", schoolId).limit(1000),
    ]);
    const activeStudents = (students.data ?? []).filter((s: any) => s.status === "active").length;
    const activeStaff = (teachers.data ?? []).filter((t: any) => t.status === "active").length;
    const activeTeachingStaff = (teachers.data ?? []).filter(
      (t: any) => t.status === "active" && TEACHING_POSITIONS.has(t.position),
    ).length;
    const totalClasses = (classes.data ?? []).length;
    const attendanceRate = (attendance.data ?? []).length
      ? Math.round((attendance.data ?? []).filter((a: any) => a.status === "present").length / (attendance.data ?? []).length * 100)
      : 0;
    return {
      summary: `${activeStudents} active students, ${activeTeachingStaff} active teaching staff, ${activeStaff} active staff, ${totalClasses} classes, ${attendanceRate}% attendance rate`,
      details: { activeStudents, activeTeachingStaff, activeStaff, totalClasses, attendanceRate, totalStudents: (students.data ?? []).length },
    };
  },
);

const get_staff_summary = makeTool(
  "get_staff_summary",
  "Get exact staff and teacher counts for the current school",
  "teachers",
  "view",
  "low",
  toolInputSchemas.get_staff_summary,
  summaryOutput,
  async (input, { schoolId }) => {
    const supabase = await createSupabaseServerClient();
    let query = supabase
      .from("staff")
      .select("staff_id, status, position")
      .eq("school_id", schoolId);

    if (input.status) {
      query = query.eq("status", input.status);
    }

    const { data, error } = await query;
    if (error) {
      throw new Error(`Failed to load staff summary: ${error.message}`);
    }

    const staff = data ?? [];
    const filtered = input.teachingOnly
      ? staff.filter((member: any) => TEACHING_POSITIONS.has(member.position))
      : staff;

    const byStatus = filtered.reduce((acc: Record<string, number>, member: any) => {
      const status = member.status ?? "unknown";
      acc[status] = (acc[status] ?? 0) + 1;
      return acc;
    }, {});

    const byPosition = filtered.reduce((acc: Record<string, number>, member: any) => {
      const position = member.position ?? "unknown";
      acc[position] = (acc[position] ?? 0) + 1;
      return acc;
    }, {});

    const activeTeachingStaff = staff.filter(
      (member: any) => member.status === "active" && TEACHING_POSITIONS.has(member.position),
    ).length;

    return {
      summary: input.teachingOnly
        ? `${filtered.length} teaching staff member(s) found${input.status ? ` with status ${input.status}` : ""}.`
        : `${filtered.length} staff member(s) found${input.status ? ` with status ${input.status}` : ""}.`,
      details: {
        total: filtered.length,
        activeTeachingStaff,
        teachingPositions: Array.from(TEACHING_POSITIONS),
        byStatus,
        byPosition,
      },
    };
  },
);

const get_timetable = makeTool(
  "get_timetable",
  "Get timetable for a class or teacher",
  "timetable",
  "view",
  "low",
  toolInputSchemas.get_timetable,
  summaryOutput,
  async (input, { schoolId }) => {
    const supabase = await createSupabaseServerClient();
    let query = supabase.from("timetable_slots").select("*, learning_area:learning_areas(name), class:classes(name), teacher:staff(staff_id, user:users(first_name, last_name))").eq("school_id", schoolId);
    if (input.classId) query = query.eq("class_id", input.classId);
    if (input.teacherId) query = query.eq("teacher_id", input.teacherId);
    if (input.dayOfWeek !== undefined) query = query.eq("day_of_week", input.dayOfWeek);
    const { data } = await query;
    return { summary: `${(data ?? []).length} timetable entries`, details: data ?? [] };
  },
);

const get_report_card_status = makeTool(
  "get_report_card_status",
  "Check report card generation/publishing status",
  "reports",
  "view",
  "low",
  toolInputSchemas.get_report_card_status,
  summaryOutput,
  async (input, { schoolId }) => {
    const supabase = await createSupabaseServerClient();
    let query = supabase.from("report_cards").select("*, students(first_name, last_name)").eq("school_id", schoolId);
    if (input.classId) query = query.eq("class_id", input.classId);
    if (input.studentId) query = query.eq("student_id", input.studentId);
    if (input.academicYearId) query = query.eq("academic_year_id", input.academicYearId);
    if (input.termId) query = query.eq("term_id", input.termId);
    const { data } = await query;
    return { summary: `${(data ?? []).length} report card(s)`, details: data ?? [] };
  },
);

const get_messages_summary = makeTool(
  "get_messages_summary",
  "Get summary of messages for the current user",
  "communication",
  "view",
  "low",
  toolInputSchemas.get_messages_summary,
  summaryOutput,
  async (input, { user }) => {
    const supabase = await createSupabaseServerClient();
    let query = supabase.from("message_recipients").select("*, messages(subject, body, created_at)").eq("user_id", user.id).order("created_at", { ascending: false }).limit(input.limit ?? 20);
    if (input.unreadOnly) query = query.eq("read_at", null);
    const { data } = await query;
    const unread = (data ?? []).filter((m: any) => !m.read_at).length;
    return { summary: `${(data ?? []).length} message(s), ${unread} unread`, details: data ?? [] };
  },
);

const get_audit_summary = makeTool(
  "get_audit_summary",
  "Get audit log entries for allowed roles",
  "audit_logs",
  "view",
  "low",
  toolInputSchemas.get_audit_summary,
  summaryOutput,
  async (input, { schoolId }) => {
    const supabase = await createSupabaseServerClient();
    let query = supabase.from("audit_logs").select("*").eq("school_id", schoolId).order("created_at", { ascending: false }).limit(input.limit ?? 20);
    if (input.module) query = query.eq("table_name", input.module);
    const { data } = await query;
    return { summary: `${(data ?? []).length} audit log entries`, details: sanitizeForAgent(data ?? []) };
  },
);

// ═══════════════════════════════════════════
// PHASE C: DRAFT & PREDICTION TOOLS
// ═══════════════════════════════════════════

const draft_parent_message = makeTool(
  "draft_parent_message",
  "Draft a message to a parent about their child",
  "communication",
  "create",
  "low",
  toolInputSchemas.draft_parent_message,
  summaryOutput,
  async (input, { user, schoolId }) => {
    const provider = getProvider();
    const result = await provider.generate({
      system: "You are a school communication assistant. Draft professional, clear messages to parents.",
      prompt: `Draft a ${input.tone ?? "formal"} message to the parent of student ${input.studentId} about: ${input.context}. Subject: ${input.subject}`,
      responseFormat: "text",
      requestLabel: "ai-agent.tool.draft_parent_message",
      temperature: 0.7,
    });
    return { summary: "Draft message created", details: { draft: result.data } };
  },
);

const draft_announcement = makeTool(
  "draft_announcement",
  "Draft a school announcement for a specific audience",
  "communication",
  "create",
  "low",
  toolInputSchemas.draft_announcement,
  summaryOutput,
  async (input) => {
    const provider = getProvider();
    const result = await provider.generate({
      system: "You are a school communications assistant. Draft clear announcements.",
      prompt: `Draft an announcement titled "${input.title}" for ${input.audience}. Context: ${input.context}`,
      responseFormat: "text",
      requestLabel: "ai-agent.tool.draft_announcement",
      temperature: 0.7,
    });
    return { summary: "Draft announcement created", details: { draft: result.data } };
  },
);

const draft_report_comment = makeTool(
  "draft_report_comment",
  "Draft a CBC report card comment for a student",
  "reports",
  "create",
  "low",
  toolInputSchemas.draft_report_comment,
  summaryOutput,
  async (input) => {
    const provider = getProvider();
    const result = await provider.generate({
      system: "You are a CBC assessment assistant. Draft constructive report comments.",
      prompt: `Draft a report comment for student ${input.studentId} in ${input.subject}. Performance: ${input.performance}. ${input.strengths ? `Strengths: ${input.strengths}.` : ""} ${input.areasToImprove ? `Areas to improve: ${input.areasToImprove}.` : ""}`,
      responseFormat: "text",
      requestLabel: "ai-agent.tool.draft_report_comment",
      temperature: 0.7,
    });
    return { summary: "Draft report comment created", details: { draft: result.data } };
  },
);

const generate_lesson_plan = makeTool(
  "generate_lesson_plan",
  "Generate a lesson plan using AI",
  "academics",
  "create",
  "low",
  toolInputSchemas.generate_lesson_plan,
  summaryOutput,
  async (input) => {
    const provider = getProvider();
    const result = await provider.generate({
      system: "You are a CBC curriculum expert. Create detailed lesson plans.",
      prompt: `Create a lesson plan for ${input.subject} - ${input.topic}, Grade: ${input.grade}, Duration: ${input.duration ?? "40 minutes"}`,
      responseFormat: "json",
      requestLabel: "ai-agent.tool.generate_lesson_plan",
      temperature: 0.7,
      responseSchema: z.object({
        title: z.string(),
        objectives: z.array(z.string()),
        materials: z.array(z.string()),
        introduction: z.string(),
        mainActivity: z.string(),
        assessment: z.string(),
        conclusion: z.string(),
      }),
    });
    const lessonData = result.data as { title: string; objectives: string[]; materials: string[]; introduction: string; mainActivity: string; assessment: string; conclusion: string };
    return { summary: `Lesson plan generated: ${lessonData.title}`, details: lessonData };
  },
);

const generate_assessment = makeTool(
  "generate_assessment",
  "Generate a test/quiz using AI",
  "assessments",
  "create",
  "low",
  toolInputSchemas.generate_assessment,
  summaryOutput,
  async (input) => {
    const provider = getProvider();
    const result = await provider.generate({
      system: "You are a CBC assessment creator. Generate age-appropriate questions.",
      prompt: `Generate ${input.questionCount ?? 10} ${input.difficulty ?? "medium"} difficulty questions for ${input.subject} - ${input.topic}, Grade: ${input.grade}`,
      responseFormat: "json",
      requestLabel: "ai-agent.tool.generate_assessment",
      temperature: 0.7,
      responseSchema: z.object({
        title: z.string(),
        questions: z.array(z.object({
          question: z.string(),
          type: z.enum(["multiple_choice", "short_answer", "essay"]),
          options: z.array(z.string()).optional(),
          correctAnswer: z.string().optional(),
          points: z.number(),
        })),
      }),
    });
    const assessmentData = result.data as { title: string; questions: Array<{ question: string; type: string; options?: string[]; correctAnswer?: string; points: number }> };
    return { summary: `Assessment generated: ${assessmentData.title}`, details: assessmentData };
  },
);

const generate_study_plan = makeTool(
  "generate_study_plan",
  "Generate a personalized study plan for a student",
  "academics",
  "create",
  "low",
  toolInputSchemas.generate_study_plan,
  summaryOutput,
  async (input) => {
    const provider = getProvider();
    const result = await provider.generate({
      system: "You are a study planning expert. Create structured study plans.",
      prompt: `Create a ${input.durationDays ?? 30}-day study plan for student ${input.studentId}. Subjects: ${input.subjects.join(", ")}. ${input.focusArea ? `Focus: ${input.focusArea}` : ""}`,
      responseFormat: "json",
      requestLabel: "ai-agent.tool.generate_study_plan",
      temperature: 0.7,
      responseSchema: z.object({
        title: z.string(),
        weeklyPlan: z.array(z.object({
          week: z.number(),
          focus: z.string(),
          dailyTasks: z.array(z.string()),
        })),
        tips: z.array(z.string()),
      }),
    });
    const planData = result.data as { title: string; weeklyPlan: Array<{ week: number; focus: string; dailyTasks: string[] }>; tips: string[] };
    return { summary: `Study plan created: ${planData.title}`, details: planData };
  },
);

const explain_cbc_result = makeTool(
  "explain_cbc_result",
  "Explain what a CBC result means",
  "assessments",
  "view",
  "low",
  toolInputSchemas.explain_cbc_result,
  summaryOutput,
  async (input) => {
    const levelMap: Record<string, string> = {
      exceeding: "Above expectation — student demonstrates exceptional understanding beyond grade level",
      meeting: "Meeting expectation — student demonstrates the expected competency",
      approaching: "Approaching expectation — student is developing but not yet meeting expectations",
      below: "Below expectation — student requires additional support to achieve the competency",
    };
    const explanation = `Score ${input.score}% / Grade ${input.grade} in ${input.subject}: ${levelMap[input.grade] ?? "See detailed assessment"}`;
    return { summary: explanation, details: { score: input.score, grade: input.grade, subject: input.subject } };
  },
);

const predict_dropout_risk = makeTool(
  "predict_dropout_risk",
  "Predict student dropout risk using attendance and performance data",
  "analytics",
  "view",
  "medium",
  toolInputSchemas.predict_dropout_risk,
  summaryOutput,
  async (input, { schoolId }) => {
    const supabase = await createSupabaseServerClient();
    const [attendance, assessments] = await Promise.all([
      supabase.from("attendance").select("status").eq("student_id", input.studentId).eq("school_id", schoolId),
      supabase.from("assessments").select("score").eq("student_id", input.studentId).eq("school_id", schoolId),
    ]);
    const attRecords = attendance.data ?? [];
    const assRecords = assessments.data ?? [];
    const attendanceRate = attRecords.length ? attRecords.filter((a: any) => a.status === "present").length / attRecords.length : 0.5;
    const avgScore = assRecords.length ? assRecords.reduce((s: number, a: any) => s + (a.score ?? 0), 0) / assRecords.length : 50;
    const riskScore = Math.round((1 - attendanceRate) * 50 + Math.max(0, 50 - avgScore) * 0.5);
    const level = riskScore > 60 ? "high" : riskScore > 35 ? "medium" : "low";
    return {
      summary: `Dropout risk: ${level.toUpperCase()} (score: ${riskScore}/100)`,
      details: { riskScore, level, attendanceRate: Math.round(attendanceRate * 100), avgScore: Math.round(avgScore) },
    };
  },
);

const predict_fee_default_risk = makeTool(
  "predict_fee_default_risk",
  "Predict fee default risk for a student or class",
  "finance",
  "view",
  "medium",
  toolInputSchemas.predict_fee_default_risk,
  summaryOutput,
  async (input, { schoolId }) => {
    const supabase = await createSupabaseServerClient();
    if (input.studentId) {
      const { data: payments } = await supabase.from("payments").select("amount, created_at").eq("student_id", input.studentId).eq("school_id", schoolId);
      const total = (payments ?? []).reduce((s: number, p: any) => s + (p.amount ?? 0), 0);
      const risk = total > 10000 ? "low" : total > 1000 ? "medium" : "high";
      return { summary: `Fee default risk: ${risk.toUpperCase()}`, details: { risk, totalPaid: total } };
    }
    return { summary: "Fee default risk analysis", details: { note: "Class-wide analysis requires student-level data" } };
  },
);

// ═══════════════════════════════════════════
// PHASE D: SAFE WRITE TOOLS
// ═══════════════════════════════════════════

const create_student = makeTool(
  "create_student",
  "Register a new student",
  "students",
  "create",
  "medium",
  toolInputSchemas.create_student,
  voidOutput,
  async (input, { schoolId }) => {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.from("students").insert({
      school_id: schoolId,
      first_name: input.firstName,
      last_name: input.lastName,
      admission_number: input.admissionNumber,
      class_id: input.classId,
      gender: input.gender,
      date_of_birth: input.dateOfBirth ?? null,
      status: "active",
    });
    if (error) throw new Error(`Failed to create student: ${error.message}`);
    return { success: true, message: `Student ${input.firstName} ${input.lastName} created successfully` };
  },
  () => true,
);

const update_student = makeTool(
  "update_student",
  "Update an existing student's details",
  "students",
  "update",
  "medium",
  toolInputSchemas.update_student,
  voidOutput,
  async (input, { schoolId }) => {
    const supabase = await createSupabaseServerClient();
    const updates: Record<string, unknown> = {};
    if (input.firstName) updates.first_name = input.firstName;
    if (input.lastName) updates.last_name = input.lastName;
    if (input.classId) updates.class_id = input.classId;
    if (input.status) updates.status = input.status;
    const { error } = await supabase.from("students").update(updates).eq("student_id", input.studentId).eq("school_id", schoolId);
    if (error) throw new Error(`Failed to update student: ${error.message}`);
    return { success: true, message: "Student updated successfully" };
  },
  () => true,
);

const record_attendance = makeTool(
  "record_attendance",
  "Record attendance for a single student",
  "attendance",
  "create",
  "medium",
  toolInputSchemas.record_attendance,
  voidOutput,
  async (input, { schoolId }) => {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.from("attendance").insert({
      school_id: schoolId,
      class_id: input.classId,
      student_id: input.studentId,
      date: input.date,
      status: input.status,
      remarks: input.remarks ?? null,
    });
    if (error) throw new Error(`Failed to record attendance: ${error.message}`);
    return { success: true, message: `Attendance recorded: ${input.studentId} - ${input.status}` };
  },
  () => true,
);

const bulk_record_attendance = makeTool(
  "bulk_record_attendance",
  "Record attendance for multiple students at once",
  "attendance",
  "create",
  "high",
  toolInputSchemas.bulk_record_attendance,
  voidOutput,
  async (input, { schoolId }) => {
    const supabase = await createSupabaseServerClient();
    const records = input.records.map((r) => ({
      school_id: schoolId,
      class_id: input.classId,
      student_id: r.studentId,
      date: input.date,
      status: r.status,
      remarks: r.remarks ?? null,
    }));
    const { error } = await supabase.from("attendance").insert(records);
    if (error) throw new Error(`Failed to record bulk attendance: ${error.message}`);
    return { success: true, message: `Attendance recorded for ${records.length} students` };
  },
  () => true,
);

const create_assessment = makeTool(
  "create_assessment",
  "Create an assessment result for a student",
  "assessments",
  "create",
  "medium",
  toolInputSchemas.create_assessment,
  voidOutput,
  async (input, { schoolId }) => {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.from("assessments").insert({
      school_id: schoolId,
      student_id: input.studentId,
      subject: input.subject,
      score: input.score,
      term_id: input.termId,
      academic_year_id: input.academicYearId,
      remarks: input.remarks ?? null,
    });
    if (error) throw new Error(`Failed to create assessment: ${error.message}`);
    return { success: true, message: `Assessment recorded: ${input.subject} - ${input.score}%` };
  },
  () => true,
);

const bulk_create_assessments = makeTool(
  "bulk_create_assessments",
  "Create assessment results for multiple students",
  "assessments",
  "create",
  "high",
  toolInputSchemas.bulk_create_assessments,
  voidOutput,
  async (input, { schoolId }) => {
    const supabase = await createSupabaseServerClient();
    const records = input.scores.map((s) => ({
      school_id: schoolId,
      student_id: s.studentId,
      subject: input.subject,
      score: s.score,
      term_id: input.termId,
      academic_year_id: input.academicYearId,
      remarks: s.remarks ?? null,
    }));
    const { error } = await supabase.from("assessments").insert(records);
    if (error) throw new Error(`Failed to create assessments: ${error.message}`);
    return { success: true, message: `Assessments recorded for ${records.length} students` };
  },
  () => true,
);

const create_discipline_record = makeTool(
  "create_discipline_record",
  "Create a discipline/conduct record for a student",
  "students",
  "create",
  "medium",
  toolInputSchemas.create_discipline_record,
  voidOutput,
  async (input, { schoolId }) => {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.from("disciplinary_records").insert({
      school_id: schoolId,
      student_id: input.studentId,
      incident_type: input.incidentType,
      description: input.description,
      date: input.date,
      action_taken: input.action ?? null,
    });
    if (error) throw new Error(`Failed to create discipline record: ${error.message}`);
    return { success: true, message: "Discipline record created" };
  },
  () => true,
);

const create_timetable_slot = makeTool(
  "create_timetable_slot",
  "Create a timetable entry",
  "timetable",
  "create",
  "medium",
  toolInputSchemas.create_timetable_slot,
  voidOutput,
  async (input, { schoolId }) => {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.from("timetable_entries").insert({
      school_id: schoolId,
      class_id: input.classId,
      subject: input.subject,
      day_of_week: input.dayOfWeek,
      start_time: input.startTime,
      end_time: input.endTime,
      teacher_id: input.teacherId ?? null,
    });
    if (error) throw new Error(`Failed to create timetable slot: ${error.message}`);
    return { success: true, message: `Timetable slot created: ${input.subject}` };
  },
  () => true,
);

const create_fee_structure = makeTool(
  "create_fee_structure",
  "Create a fee structure for a class/term",
  "finance",
  "create",
  "high",
  toolInputSchemas.create_fee_structure,
  voidOutput,
  async (input, { schoolId }) => {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.from("fee_structures").insert({
      school_id: schoolId,
      class_id: input.classId,
      academic_year_id: input.academicYearId,
      term_id: input.termId,
      amount: input.amount,
      description: input.description ?? null,
    });
    if (error) throw new Error(`Failed to create fee structure: ${error.message}`);
    return { success: true, message: `Fee structure created: KES ${input.amount.toLocaleString()}` };
  },
  () => true,
);

const assign_student_fee = makeTool(
  "assign_student_fee",
  "Assign a fee to a specific student",
  "finance",
  "create",
  "high",
  toolInputSchemas.assign_student_fee,
  voidOutput,
  async (input, { schoolId }) => {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.from("student_fees").insert({
      school_id: schoolId,
      student_id: input.studentId,
      fee_structure_id: input.feeStructureId,
      amount: input.amount ?? null,
      due_date: input.dueDate ?? null,
    });
    if (error) throw new Error(`Failed to assign fee: ${error.message}`);
    return { success: true, message: "Fee assigned to student" };
  },
  () => true,
);

const record_payment = makeTool(
  "record_payment",
  "Record a payment from a student",
  "finance",
  "create",
  "high",
  toolInputSchemas.record_payment,
  voidOutput,
  async (input, { schoolId }) => {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.from("payments").insert({
      school_id: schoolId,
      student_id: input.studentId,
      amount: input.amount,
      payment_method: input.paymentMethod,
      transaction_ref: input.transactionRef ?? null,
      term_id: input.termId,
      academic_year_id: input.academicYearId,
      notes: input.notes ?? null,
    });
    if (error) throw new Error(`Failed to record payment: ${error.message}`);
    return { success: true, message: `Payment of KES ${input.amount.toLocaleString()} recorded` };
  },
  () => true,
);

const send_message = makeTool(
  "send_message",
  "Send a message to a parent, teacher, or staff member",
  "communication",
  "create",
  "high",
  toolInputSchemas.send_message,
  voidOutput,
  async (input, { schoolId, user }) => {
    const supabase = await createSupabaseServerClient();
    const { data: msg, error } = await supabase.from("messages").insert({
      school_id: schoolId,
      sender_id: user.id,
      sender_role: user.role,
      subject: input.subject,
      body: input.body,
      priority: input.priority ?? "normal",
    }).select("message_id").single();

    if (error) throw new Error(`Failed to send message: ${error.message}`);
    if (msg) {
      await supabase.from("message_recipients").insert({
        message_id: msg.message_id,
        user_id: input.recipientId,
      });
    }
    return { success: true, message: "Message sent successfully" };
  },
  () => true,
);

const create_announcement = makeTool(
  "create_announcement",
  "Create a school announcement",
  "communication",
  "create",
  "high",
  toolInputSchemas.create_announcement,
  voidOutput,
  async (input, { schoolId }) => {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.from("announcements").insert({
      school_id: schoolId,
      title: input.title,
      body: input.body,
      audience: input.audience,
      priority: input.priority ?? "normal",
    });
    if (error) throw new Error(`Failed to create announcement: ${error.message}`);
    return { success: true, message: `Announcement "${input.title}" created` };
  },
  () => true,
);

const generate_report_cards = makeTool(
  "generate_report_cards",
  "Generate report cards for a class",
  "reports",
  "create",
  "high",
  toolInputSchemas.generate_report_cards,
  voidOutput,
  async (input, { schoolId }) => {
    const supabase = await createSupabaseServerClient();
    let query = supabase.from("students").select("student_id").eq("class_id", input.classId).eq("school_id", schoolId).eq("status", "active");
    if (input.studentIds) query = query.in("student_id", input.studentIds);
    const { data: students } = await query;
    if (!students?.length) throw new Error("No students found");

    const records = students.map((s: any) => ({
      school_id: schoolId,
      student_id: s.student_id,
      class_id: input.classId,
      academic_year_id: input.academicYearId,
      term_id: input.termId,
      status: "draft",
    }));
    const { error } = await supabase.from("report_cards").insert(records);
    if (error) throw new Error(`Failed to generate report cards: ${error.message}`);
    return { success: true, message: `Report cards generated for ${records.length} students` };
  },
  () => true,
);

// ═══════════════════════════════════════════
// PHASE E: HIGH-RISK TOOLS
// ═══════════════════════════════════════════

const delete_student = makeTool(
  "delete_student",
  "Delete/withdraw a student from the school",
  "students",
  "delete",
  "critical",
  toolInputSchemas.delete_student,
  voidOutput,
  async (input, { schoolId }) => {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.from("students").update({ status: "withdrawn" }).eq("student_id", input.studentId).eq("school_id", schoolId);
    if (error) throw new Error(`Failed to delete student: ${error.message}`);
    return { success: true, message: `Student withdrawn: ${input.reason}` };
  },
  () => true,
);

const change_user_role = makeTool(
  "change_user_role",
  "Change a user's role in the system",
  "users",
  "update",
  "critical",
  toolInputSchemas.change_user_role,
  voidOutput,
  async (input, { schoolId, user }) => {
    if (!canManageRole(user.role as any, input.newRole as any)) {
      throw new Error(`You cannot assign the role "${input.newRole}" — it is at or above your own role level`);
    }
    const supabase = await createSupabaseServerClient();
    const { data: target } = await supabase.from("user_roles").select("name").eq("user_id", input.userId).maybeSingle();
    if (target && !canManageRole(user.role as any, target.name as any)) {
      throw new Error("You cannot change this user's role — they are at or above your role level");
    }
    const { error } = await supabase.from("user_roles").update({ name: input.newRole }).eq("user_id", input.userId).eq("school_id", schoolId);
    if (error) throw new Error(`Failed to change role: ${error.message}`);
    return { success: true, message: `User role changed to ${input.newRole}: ${input.reason}` };
  },
  () => true,
);

const waive_fee = makeTool(
  "waive_fee",
  "Approve a fee waiver for a student",
  "finance",
  "approve",
  "critical",
  toolInputSchemas.waive_fee,
  voidOutput,
  async (input, { schoolId, user }) => {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.from("fee_waivers").insert({
      school_id: schoolId,
      student_id: input.studentId,
      amount: input.amount,
      reason: input.reason,
      term_id: input.termId,
      academic_year_id: input.academicYearId,
      approved_by: user.id,
    });
    if (error) throw new Error(`Failed to waive fee: ${error.message}`);
    return { success: true, message: `Fee waiver of KES ${input.amount.toLocaleString()} approved` };
  },
  () => true,
);

const publish_report_cards = makeTool(
  "publish_report_cards",
  "Publish report cards for a class (makes them visible to parents/students)",
  "reports",
  "publish",
  "critical",
  toolInputSchemas.publish_report_cards,
  voidOutput,
  async (input, { schoolId }) => {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.from("report_cards").update({ status: "published", published_at: new Date().toISOString() }).eq("class_id", input.classId).eq("school_id", schoolId).eq("academic_year_id", input.academicYearId).eq("term_id", input.termId);
    if (error) throw new Error(`Failed to publish report cards: ${error.message}`);
    return { success: true, message: "Report cards published" };
  },
  () => true,
);

const change_active_term = makeTool(
  "change_active_term",
  "Change the active academic term for the school",
  "settings",
  "update",
  "critical",
  toolInputSchemas.change_active_term,
  voidOutput,
  async (input, { schoolId }) => {
    const supabase = await createSupabaseServerClient();
    const { error: deactivateTermErr } = await supabase.from("terms").update({ is_active: false }).eq("school_id", schoolId);
    if (deactivateTermErr) throw new Error(`Failed to deactivate current term: ${deactivateTermErr.message}`);
    const { error: deactivateYearErr } = await supabase.from("academic_years").update({ is_active: false }).eq("school_id", schoolId);
    if (deactivateYearErr) throw new Error(`Failed to deactivate current year: ${deactivateYearErr.message}`);
    const { error: activateTermErr } = await supabase.from("terms").update({ is_active: true }).eq("term_id", input.termId).eq("school_id", schoolId);
    if (activateTermErr) throw new Error(`Failed to activate term: ${activateTermErr.message}`);
    const { error: activateYearErr } = await supabase.from("academic_years").update({ is_active: true }).eq("academic_year_id", input.academicYearId).eq("school_id", schoolId);
    if (activateYearErr) throw new Error(`Failed to activate academic year: ${activateYearErr.message}`);
    return { success: true, message: `Active term changed: ${input.reason}` };
  },
  () => true,
);

// ═══════════════════════════════════════════
// QUERY SCHOOL DATA — Dynamic read-only query tool
// ═══════════════════════════════════════════

const query_school_data = makeTool(
  "query_school_data",
  "Query school data dynamically. Use for counting, listing, or summarizing any entity. Supports filtering, grouping, search, and ordering. Safe read-only queries against the data catalog.",
  "analytics",
  "view",
  "low",
  toolInputSchemas.query_school_data,
  queryOutput,
  async (input, { user }) => {
    const result = await executeSafeQuery(input, user);
    return result as unknown as QuerySchoolDataOutput;
  },
);

// ═══════════════════════════════════════════
// REGISTRY
// ═══════════════════════════════════════════

const ALL_TOOLS: AgentTool<any, any>[] = [
  // Phase B: Read-only
  query_school_data,
  search_students,
  get_student_profile,
  get_student_attendance_summary,
  get_student_assessment_summary,
  get_student_fee_summary,
  get_class_roster,
  get_class_attendance_summary,
  get_class_performance_summary,
  get_school_health_summary,
  get_staff_summary,
  get_timetable,
  get_report_card_status,
  get_messages_summary,
  get_audit_summary,
  // Phase C: Draft & Prediction
  draft_parent_message,
  draft_announcement,
  draft_report_comment,
  generate_lesson_plan,
  generate_assessment,
  generate_study_plan,
  explain_cbc_result,
  predict_dropout_risk,
  predict_fee_default_risk,
  // Phase D: Safe Write
  create_student,
  update_student,
  record_attendance,
  bulk_record_attendance,
  create_assessment,
  bulk_create_assessments,
  create_discipline_record,
  create_timetable_slot,
  create_fee_structure,
  assign_student_fee,
  record_payment,
  send_message,
  create_announcement,
  generate_report_cards,
  // Phase E: High-risk
  delete_student,
  change_user_role,
  waive_fee,
  publish_report_cards,
  change_active_term,
];

export function getAvailableToolsForUser(user: AuthUser): AgentTool[] {
  const userPermissions = PERMISSION_MATRIX[user.role] ?? {};
  return ALL_TOOLS.filter((tool) => {
    const modulePerms = userPermissions[tool.module];
    if (!modulePerms) return false;
    return modulePerms.includes(tool.action);
  });
}

export function findTool(name: string): AgentTool | undefined {
  return ALL_TOOLS.find((t) => t.name === name);
}

export function getToolNamesForUser(user: AuthUser): string[] {
  return getAvailableToolsForUser(user).map((t) => t.name);
}

export { ALL_TOOLS };
