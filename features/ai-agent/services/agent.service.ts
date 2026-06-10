import type { AuthUser } from "@/types/auth";
import type { AgentChatRequest, AgentChatResponse, AgentPlan, AgentExecutionContext, AgentTool } from "@/features/ai-agent/types";
import { agentPlanSchema } from "@/features/ai-agent/validators/aiAgent.schema";
import { getProvider } from "@/lib/ai/providers";
import { getAvailableToolsForUser, getToolNamesForUser } from "./tool-registry.service";
import { executeTool, ToolExecutionError } from "./tool-executor.service";
import { buildPageContext, sanitizeForAgent } from "./context-builder.service";
import { createSession, saveMessage, getLastMessages, getSession, updateSessionStatus } from "./memory.service";
import { logAgentAIEvent } from "./agent-audit.service";

const SYSTEM_PROMPT = `You are an AI assistant for the CBC School Management System.

## Your Role
- You act as the logged-in user and operate with their exact permissions.
- You can answer questions, retrieve school data, and perform permitted actions.
- You must NEVER invent data. Only use information returned by your tools.
- You must NEVER claim an action is complete unless the tool output confirms it.
- You must keep role confidentiality. Do not expose data the user cannot see in the UI.
- If you cannot fulfill a request due to permissions or missing data, explain what you CAN do instead.
- If the user asks about their current page or module, use the Current Context section to answer.
- You may answer harmless general questions such as today's date/day/time directly from Current Context.
- For school data counts, totals, lists, balances, or summaries, you must use a tool. Do not estimate or infer counts from conversation text.

## How to Respond
Analyze the user's request and produce a plan with this structure:
- **intent**: One of "answer", "retrieve", "act", "clarify", "refuse"
- **userGoal**: Brief summary of what the user wants
- **toolName**: The tool to use (or null for answer/clarify/refuse)
- **toolInput**: Parameters for the tool (or null)
- **requiresConfirmation**: Whether the action needs user confirmation
- **riskLevel**: "low", "medium", "high", or "critical"
- **reasoningSummary**: Brief explanation of your plan
- **userFacingMessage**: Your response to the user, clear and professional

## Rules
- For informational questions, use "answer" intent.
- For harmless general context questions like today's date/day/time, use "answer" intent.
- For data retrieval, use "retrieve" intent with the appropriate tool.
- For actions (create, update, delete), use "act" intent.
- If unsure about the request, use "clarify" intent.
- If the request is outside your permissions or capabilities, use "refuse" intent.
- Read-only operations (view/search) are low risk.
- Drafting content with AI is low risk.
- Creating/updating records requires medium risk.
- Financial operations, messaging, and bulk operations are high risk.
- Deletes, role changes, term/year changes, publishing, fee waivers are critical risk.
- Always prefer summaries over exposing raw row-level data unless the user asks for specifics.
- Do NOT use markdown formatting (no asterisks, no bold, no italics). Use plain text only.
- When you need to retrieve data, choose the most specific tool available. For example, use "get_student_profile" rather than "search_students" if the user mentions a specific student.
- If the user asks for information that requires multiple tools, plan to use the most relevant tool first and state what additional data you might need.
- If required fields are missing from a tool input, use "clarify" intent and ask the user for the missing information.
- If a user asks about something outside their role's modules, politely refuse and mention what modules they DO have access to.

## Using query_school_data
- For any question asking about counts, how many, list, show, find, total, balance, status, absent, present, paid, unpaid, published, active, inactive, assigned, or registered — use query_school_data with the correct entity unless a more specific tool is clearly better.
- query_school_data supports entities: students, staff, classes, attendance, assessments, assessment_aggregates, report_cards, student_fees, payments, fee_structures, messages, announcements, timetable_slots, disciplinary_records, special_needs, teacher_subjects, academic_years, terms.
- Use "operation": "count" for totals. Use "operation": "list" for detailed records. Use "operation": "summary" with "groupBy" for grouped counts.
- Always include relevant filters (e.g., status: "active", is_published: true, date ranges).
- Never request columns that are not described in the tool description.
- query_school_data is read-only. Never use it to create, update, or delete records.

### Examples

User: "How many teachers are here?"
Plan: {"intent":"retrieve","toolName":"query_school_data","toolInput":{"entity":"staff","operation":"count","filters":[{"field":"status","operator":"eq","value":"active"},{"field":"position","operator":"in","value":["class_teacher","subject_teacher","principal","deputy_principal"]}]}}

User: "Show absent students today"
Plan: {"intent":"retrieve","toolName":"query_school_data","toolInput":{"entity":"attendance","operation":"list","filters":[{"field":"date","operator":"eq","value":"CURRENT_DATE"},{"field":"status","operator":"eq","value":"absent"}],"select":["student_id","class_id","date","status"],"limit":100}}

User: "Who has unpaid fees?"
Plan: {"intent":"retrieve","toolName":"query_school_data","toolInput":{"entity":"student_fees","operation":"list","filters":[{"field":"balance","operator":"gt","value":0}],"select":["student_id","amount_due","amount_paid","balance","status"],"limit":100}}

User: "How many students are in Grade 6?"
Plan: {"intent":"retrieve","toolName":"query_school_data","toolInput":{"entity":"students","operation":"count","filters":[{"field":"status","operator":"eq","value":"active"}],"limit":100}}

User: "Show me fee defaulters this term"
Plan: {"intent":"retrieve","toolName":"query_school_data","toolInput":{"entity":"student_fees","operation":"list","filters":[{"field":"balance","operator":"gt","value":0},{"field":"status","operator":"in","value":["pending","overdue"]}],"select":["student_id","amount_due","amount_paid","balance","status"],"limit":100}}

User: "What is the balance for admission number ADM001?"
Plan: {"intent":"retrieve","toolName":"query_school_data","toolInput":{"entity":"student_fees","operation":"list","filters":[{"field":"status","operator":"eq","value":"active"}],"select":["student_id","amount_due","amount_paid","balance","status"],"limit":5}}

User: "Show students with low attendance"
Plan: {"intent":"retrieve","toolName":"query_school_data","toolInput":{"entity":"attendance","operation":"summary","filters":[{"field":"status","operator":"eq","value":"absent"}],"groupBy":["student_id"],"limit":100}}`;

const DEFAULT_AGENT_TIME_ZONE = process.env.AI_AGENT_TIMEZONE ?? "Europe/London";

export async function processAgentMessage(
  request: AgentChatRequest,
  user: AuthUser,
): Promise<AgentChatResponse> {
  const startedAt = Date.now();
  const schoolId = user.schoolId ?? "";

  let sessionId = request.sessionId;

  if (sessionId) {
    const existing = await getSession(sessionId);
    if (!existing) {
      sessionId = await createSession(user.id, schoolId, request.mode ?? "assist");
    } else if (existing.status !== "active") {
      sessionId = await createSession(user.id, schoolId, request.mode ?? "assist");
    }
  } else {
    sessionId = await createSession(user.id, schoolId, request.mode ?? "assist");
  }

  await saveMessage(sessionId, "user", request.message, schoolId, {
    pageContext: request.pageContext,
  });

  const pageContext = await buildPageContext(user, request.pageContext);
  const recentMessages = await getLastMessages(sessionId, 10);
  const availableTools = getAvailableToolsForUser(user);
  const toolNames = availableTools.map((t) => t.name);

  const deterministicResponse = await handleDeterministicRequest({
    request,
    user,
    schoolId,
    sessionId,
    availableTools,
  });
  if (deterministicResponse) {
    return deterministicResponse;
  }

  const conversationHistory = recentMessages
    .map((m) => `${m.role.toUpperCase()}: ${m.content}`)
    .join("\n");

  const toolsDescription = availableTools
    .map(
      (t) =>
        `- ${t.name}: ${t.description} [${t.module}/${t.action}] (risk: ${t.riskLevel})`,
    )
    .join("\n");

  const systemContext = `${SYSTEM_PROMPT}

## Current Context
- School: ${pageContext.schoolName}
- Active Year: ${pageContext.activeAcademicYear ?? "Not set"}
- Active Term: ${pageContext.activeTerm ?? "Not set"}
- Your Role: ${pageContext.userRole}
- Your Modules: ${pageContext.allowedModules.join(", ")}
- Current Page: ${pageContext.currentPage ?? "Not on a specific page"}
- Current Module: ${pageContext.currentModule ?? "N/A"}

## Tools Available to You
${toolsDescription || "No tools available with your current permissions."}

## Recent Conversation
${conversationHistory || "No previous messages in this session."}

## User's New Request
${request.message}`;

  const provider = getProvider();

  // Step 1: Plan
  const planResult = await provider.generate<AgentPlan>({
    system: systemContext,
    prompt: `Analyze this request and produce a JSON plan with intent, toolName (if applicable), toolInput, requiresConfirmation, riskLevel, reasoningSummary, and userFacingMessage.`,
    responseFormat: "json",
    responseSchema: agentPlanSchema,
    requestLabel: "ai-agent.plan",
    temperature: 0.3,
    maxOutputTokens: 1000,
  });

  if (!planResult.success) {
    return buildErrorResponse(sessionId, "Failed to analyze your request. Please try again.");
  }

  const plan = planResult.data as AgentPlan;

  // Handle refusal
  if (plan.intent === "refuse") {
    await saveMessage(sessionId, "assistant", plan.userFacingMessage, schoolId);
    return {
      sessionId,
      message: { role: "assistant", content: plan.userFacingMessage },
      confidence: planResult.confidence,
      warnings: planResult.warnings ?? [],
    };
  }

  // Handle clarification
  if (plan.intent === "clarify") {
    await saveMessage(sessionId, "assistant", plan.userFacingMessage, schoolId);
    return {
      sessionId,
      message: { role: "assistant", content: plan.userFacingMessage },
      confidence: planResult.confidence,
      warnings: planResult.warnings ?? [],
    };
  }

  // Handle answering (no tool needed)
  if (plan.intent === "answer") {
    await saveMessage(sessionId, "assistant", plan.userFacingMessage, schoolId);
    return {
      sessionId,
      message: { role: "assistant", content: plan.userFacingMessage },
      confidence: planResult.confidence,
      warnings: planResult.warnings ?? [],
    };
  }

  // Handle retrieval or action
  if (plan.intent === "retrieve" || plan.intent === "act") {
    if (!plan.toolName) {
      await saveMessage(sessionId, "assistant", plan.userFacingMessage, schoolId);
      return {
        sessionId,
        message: { role: "assistant", content: plan.userFacingMessage },
        confidence: planResult.confidence,
        warnings: planResult.warnings ?? [],
      };
    }

    const tool = availableTools.find((t) => t.name === plan.toolName);
    if (!tool) {
      const msg = `I cannot use "${plan.toolName}" — it is not available with your current permissions. ${plan.userFacingMessage}`;
      await saveMessage(sessionId, "assistant", msg, schoolId);
      return {
        sessionId,
        message: { role: "assistant", content: msg },
        confidence: planResult.confidence,
        warnings: [...(planResult.warnings ?? []), `Tool "${plan.toolName}" not available`],
      };
    }

    const context: AgentExecutionContext = {
      user,
      schoolId,
      sessionId,
      requestId: `chat-${sessionId}-${Date.now()}`,
    };

    try {
      const result = await executeTool(
        plan.toolName,
        (plan.toolInput ?? {}) as Record<string, unknown>,
        context,
      );

      // Step 2: Generate user-friendly response with tool output
      if (result.requiresConfirmation) {
        const msg = `${plan.userFacingMessage}\n\nI need your confirmation before proceeding. Please review the action details below.`;
        await saveMessage(sessionId, "assistant", msg, schoolId, {
          actionPreview: result.preview,
          actionId: result.actionId,
          requiresConfirmation: true,
        });
        return {
          sessionId,
          message: { role: "assistant", content: msg },
          action: {
            actionId: result.actionId,
            status: "awaiting_confirmation",
            preview: result.preview as Record<string, unknown>,
            riskLevel: plan.riskLevel,
            requiresConfirmation: true,
          },
          confidence: planResult.confidence,
          warnings: planResult.warnings ?? [],
        };
      }

      const responseResult = await provider.generate({
        system: `You are a helpful school assistant. Explain the following result to the user in a clear, friendly way. Keep it concise. Do not invent additional information. Do NOT use markdown formatting (no asterisks, no bold, no italics).`,
        prompt: `The user asked: "${request.message}"\n\nTool "${plan.toolName}" returned:\n${JSON.stringify(result.output, null, 2)}\n\nExplain this result to the user.`,
        responseFormat: "text",
        requestLabel: "ai-agent.answer",
        temperature: 0.5,
        maxOutputTokens: 800,
      });

      const answerText = responseResult.success
        ? (responseResult.data as string)
        : plan.userFacingMessage;

      await saveMessage(sessionId, "assistant", answerText, schoolId, {
        toolName: plan.toolName,
        toolOutput: result.output,
      });

      // Log AI event
      const durationMs = Date.now() - startedAt;
      await logAgentAIEvent({
        requestLabel: `ai-agent.tool.${plan.toolName}`,
        model: planResult.meta?.model ?? "unknown",
        schoolId,
        prompt: request.message,
        response: answerText,
        success: true,
        durationMs,
      });

      return {
        sessionId,
        message: { role: "assistant", content: answerText },
        confidence: responseResult.success ? responseResult.confidence : planResult.confidence,
        warnings: [...(planResult.warnings ?? []), ...(responseResult.warnings ?? [])],
      };
    } catch (error) {
      const errorMessage = error instanceof ToolExecutionError ? error.message : "An unexpected error occurred";

      await saveMessage(sessionId, "assistant", `Error: ${errorMessage}`, schoolId);

      await logAgentAIEvent({
        requestLabel: `ai-agent.tool.${plan.toolName}`,
        model: planResult.meta?.model ?? "unknown",
        schoolId,
        prompt: request.message,
        success: false,
        durationMs: Date.now() - startedAt,
        error: errorMessage,
      });

      return buildErrorResponse(sessionId, errorMessage);
    }
  }

  return buildErrorResponse(sessionId, "Unable to process your request. Please try again.");
}

function buildErrorResponse(sessionId: string, message: string): AgentChatResponse {
  return {
    sessionId,
    message: { role: "assistant", content: message },
    confidence: 0,
    warnings: [message],
  };
}

export function buildCurrentDateAnswer(date = new Date(), timeZone = DEFAULT_AGENT_TIME_ZONE): string {
  const weekday = new Intl.DateTimeFormat("en-GB", { weekday: "long", timeZone }).format(date);
  const fullDate = new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone,
  }).format(date);

  return `Today is ${weekday}, ${fullDate}.`;
}

export function isCurrentDateQuestion(message: string): boolean {
  const normalized = message.toLowerCase().trim();
  return (
    /\b(what|which)\s+(is\s+)?(the\s+)?(day|date)\s+(is\s+)?(today|now)\b/.test(normalized) ||
    /\b(today'?s|current)\s+(day|date)\b/.test(normalized) ||
    /\bwhat\s+day\s+is\s+it\b/.test(normalized)
  );
}

export function getStaffSummaryToolInput(message: string): Record<string, unknown> | null {
  const normalized = message.toLowerCase();
  const isCountQuestion = /\b(how many|number of|count|total)\b/.test(normalized);
  const asksStaff = /\b(staff|teacher|teachers|teaching staff)\b/.test(normalized);

  if (!isCountQuestion || !asksStaff) {
    return null;
  }

  const asksTeachers = /\b(teacher|teachers|teaching staff)\b/.test(normalized);
  const asksAll = /\b(all|total)\b/.test(normalized);
  const asksInactive = /\b(inactive|suspended|archived)\b/.test(normalized);

  const input: Record<string, unknown> = {
    teachingOnly: asksTeachers,
  };

  if (asksInactive) {
    if (normalized.includes("suspended")) input.status = "suspended";
    else if (normalized.includes("archived")) input.status = "archived";
    else input.status = "inactive";
  } else if (!asksAll) {
    input.status = "active";
  }

  return input;
}

async function handleDeterministicRequest(args: {
  request: AgentChatRequest;
  user: AuthUser;
  schoolId: string;
  sessionId: string;
  availableTools: AgentTool[];
}): Promise<AgentChatResponse | null> {
  const { request, user, schoolId, sessionId, availableTools } = args;

  if (isCurrentDateQuestion(request.message)) {
    const content = buildCurrentDateAnswer();
    await saveMessage(sessionId, "assistant", content, schoolId, {
      deterministic: true,
      type: "current_date",
    });
    return {
      sessionId,
      message: { role: "assistant", content },
      confidence: 1,
      warnings: [],
    };
  }

  const staffInput = getStaffSummaryToolInput(request.message);
  if (!staffInput) {
    return null;
  }

  const tool = availableTools.find((candidate) => candidate.name === "get_staff_summary");
  if (!tool) {
    const content = "I cannot view staff or teacher counts with your current role. I can help with the modules available to you instead.";
    await saveMessage(sessionId, "assistant", content, schoolId, {
      deterministic: true,
      type: "staff_summary_denied",
    });
    return {
      sessionId,
      message: { role: "assistant", content },
      confidence: 1,
      warnings: ["get_staff_summary not available for this role"],
    };
  }

  const result = await executeTool("get_staff_summary", staffInput, {
    user,
    schoolId,
    sessionId,
    requestId: `deterministic-${sessionId}-${Date.now()}`,
  });

  const details = (result.output.details ?? {}) as Record<string, unknown>;
  const teachingOnly = staffInput.teachingOnly === true;
  const total = typeof details.total === "number" ? details.total : null;
  const activeTeachingStaff =
    typeof details.activeTeachingStaff === "number" ? details.activeTeachingStaff : null;
  const byPosition = details.byPosition as Record<string, number> | undefined;

  const content = teachingOnly
    ? `There ${total === 1 ? "is" : "are"} ${total ?? "no"} ${staffInput.status === "active" ? "active " : ""}teacher${total === 1 ? "" : "s"} in this school.`
    : `There ${total === 1 ? "is" : "are"} ${total ?? "no"} ${staffInput.status === "active" ? "active " : ""}staff member${total === 1 ? "" : "s"} in this school.${activeTeachingStaff !== null ? ` Active teaching staff: ${activeTeachingStaff}.` : ""}`;

  const breakdown = byPosition && Object.keys(byPosition).length > 0
    ? ` Breakdown by position: ${Object.entries(byPosition)
        .map(([position, count]) => `${position.replace(/_/g, " ")} ${count}`)
        .join(", ")}.`
    : "";

  const finalContent = `${content}${breakdown}`;

  await saveMessage(sessionId, "assistant", finalContent, schoolId, {
    deterministic: true,
    type: "staff_summary",
    toolName: "get_staff_summary",
    toolOutput: result.output,
  });

  return {
    sessionId,
    message: { role: "assistant", content: finalContent },
    confidence: 1,
    warnings: [],
  };
}
