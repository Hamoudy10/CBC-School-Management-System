import type { AuthUser } from "@/types/auth";
import type { AgentChatRequest, AgentChatResponse, AgentPlan, AgentExecutionContext, AgentTool } from "@/features/ai-agent/types";
import { agentPlanSchema } from "@/features/ai-agent/validators/aiAgent.schema";
import { getProvider, AIProviderError } from "@/lib/ai/providers";
import { getAvailableToolsForUser, getToolNamesForUser } from "./tool-registry.service";
import { executeTool, ToolExecutionError } from "./tool-executor.service";
import { buildPageContext, sanitizeForAgent } from "./context-builder.service";
import { getDataCatalog } from "./data-catalog.service";
import { createSession, saveMessage, getLastMessages, getSession, updateSessionStatus } from "./memory.service";
import { logAgentAIEvent } from "./agent-audit.service";

const SYSTEM_PROMPT = `You are an AI assistant for the CBC School Management System. You act as the logged-in user with their exact permissions.

## Core Rules
- NEVER invent data, dates, counts, totals, balances, or names. Only use information returned by tools or provided in Current Context.
- The current date and time are provided in Current Context below. Do not guess them.
- For data questions (counts, how many, list, show, total, balance, status), use query_school_data with the correct entity unless a more specific tool is clearly better.
- Never estimate or infer counts from conversation text. Always use a tool.
- Keep role confidentiality. Do not expose data the user cannot see in the UI.
- Prefer summaries over raw row-level data unless the user asks for specifics.
- Do NOT use markdown formatting (no asterisks, bold, italics). Plain text only.
- If required fields are missing from a tool input, use clarify intent and ask the user.
- If outside permissions, refuse politely and mention what modules they DO have access to.

## Plan Structure
Analyze requests and produce a JSON plan: intent ("answer"|"retrieve"|"act"|"clarify"|"refuse"), userGoal, toolName (or null), toolInput (or null), requiresConfirmation, riskLevel ("low"|"medium"|"high"|"critical"), reasoningSummary, userFacingMessage.

## Risk Levels
- Low: view/search/draft. Medium: create/update single records. High: finance/bulk ops/messaging. Critical: deletes/role changes/fee waivers/publishing/term changes.

## query_school_data
Available entities with their column schemas are listed in Entity Columns below. Use the correct filterable field names — e.g. staff position is "position", not "role". For name fields on staff, select from users join (first_name, last_name).
Operations: count (totals), list (records), summary (groupBy), exists. Always include relevant filters like status, is_published, date ranges. Read-only.

### Examples
User: "How many teachers?" → {"intent":"retrieve","toolName":"query_school_data","toolInput":{"entity":"staff","operation":"count","filters":[{"field":"status","operator":"eq","value":"active"}]}}
User: "Show absent students today" → {"intent":"retrieve","toolName":"query_school_data","toolInput":{"entity":"attendance","operation":"list","filters":[{"field":"date","operator":"eq","value":"CURRENT_DATE"},{"field":"status","operator":"eq","value":"absent"}],"select":["student_id","class_id","date","status"],"limit":100}}
User: "Unpaid fees?" → {"intent":"retrieve","toolName":"query_school_data","toolInput":{"entity":"student_fees","operation":"list","filters":[{"field":"balance","operator":"gt","value":0}],"select":["student_id","amount_due","amount_paid","balance","status"],"limit":100}}
User: "How many active students?" → {"intent":"retrieve","toolName":"query_school_data","toolInput":{"entity":"students","operation":"count","filters":[{"field":"status","operator":"eq","value":"active"}]}}
User: "Low attendance students" → {"intent":"retrieve","toolName":"query_school_data","toolInput":{"entity":"attendance","operation":"summary","filters":[{"field":"status","operator":"eq","value":"absent"}],"groupBy":["student_id"],"limit":100}}`;

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
- Current Date: ${new Intl.DateTimeFormat("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: DEFAULT_AGENT_TIME_ZONE }).format(new Date())}
- Current Time: ${new Intl.DateTimeFormat("en-GB", { hour: "numeric", minute: "numeric", timeZone: DEFAULT_AGENT_TIME_ZONE, timeZoneName: "short" }).format(new Date())}
- Your Role: ${pageContext.userRole}
- Your Modules: ${pageContext.allowedModules.join(", ")}
- Current Page: ${pageContext.currentPage ?? "Not on a specific page"}
- Current Module: ${pageContext.currentModule ?? "N/A"}

## Entity Columns
${buildEntityColumnsHelp()}

## Tools Available to You
${toolsDescription || "No tools available with your current permissions."}

## Recent Conversation
${conversationHistory || "No previous messages in this session."}

## User's New Request
${request.message}`;

  const provider = getProvider();

  // Step 1: Plan
  let planResult: import("@/features/ai-agent/types").AIProviderResponse<AgentPlan | string>;
  try {
    planResult = await provider.generate<AgentPlan>({
      system: systemContext,
      prompt: `Analyze this request and produce a JSON plan with intent, toolName (if applicable), toolInput, requiresConfirmation, riskLevel, reasoningSummary, and userFacingMessage.`,
      responseFormat: "json",
      responseSchema: agentPlanSchema,
      requestLabel: "ai-agent.plan",
      temperature: 0.3,
      maxOutputTokens: 1000,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unexpected error during planning";
    await logAgentAIEvent({
      requestLabel: "ai-agent.plan",
      model: "unknown",
      schoolId,
      prompt: request.message,
      success: false,
      durationMs: Date.now() - startedAt,
      error: msg,
    });
    const isSchemaError = msg.includes("did not match schema") || msg.includes("invalid JSON");
    const userMessage = isSchemaError
      ? "I had trouble understanding your request. Please try rephrasing it more clearly."
      : "I encountered an issue while processing your request. Please try rephrasing.";
    return buildErrorResponse(sessionId, userMessage);
  }

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
      const rawMessage = error instanceof ToolExecutionError ? error.message : (error instanceof AIProviderError ? error.message : "An unexpected error occurred");

      const sanitizedMessage = rawMessage.includes("did not match schema") || rawMessage.includes("invalid JSON") || rawMessage.includes("API key")
        ? "I could not complete that action. Please try a different approach."
        : rawMessage;

      await saveMessage(sessionId, "assistant", `Error: ${sanitizedMessage}`, schoolId);

      await logAgentAIEvent({
        requestLabel: `ai-agent.tool.${plan.toolName}`,
        model: planResult.meta?.model ?? "unknown",
        schoolId,
        prompt: request.message,
        success: false,
        durationMs: Date.now() - startedAt,
        error: rawMessage,
      });

      return buildErrorResponse(sessionId, sanitizedMessage);
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

export function buildCurrentTimeAnswer(date = new Date(), timeZone = DEFAULT_AGENT_TIME_ZONE): string {
  const time = new Intl.DateTimeFormat("en-GB", {
    hour: "numeric",
    minute: "numeric",
    timeZone,
    timeZoneName: "short",
  }).format(date);

  return `The current time is ${time}.`;
}

export function isCurrentDateQuestion(message: string): boolean {
  const n = message.toLowerCase().trim();
  return (
    /\b(?:whats|what's|what|which)\s+(?:is\s+)?(?:the\s+)?(?:day|date)\s+(?:is\s+)?(?:today|now)\b/.test(n) ||
    /\bwhat\s+day\s+is\s+it\b/.test(n) ||
    /\btoday'?s?\s+date\b/.test(n) ||
    /\bcurrent\s+(?:date|day)\b/.test(n) ||
    /\b(?:date|day)\s+today\b/.test(n)
  );
}

export function isCurrentTimeQuestion(message: string): boolean {
  const n = message.toLowerCase().trim();
  return (
    /\bwhat\s+(?:time|clock)\s+is\s+it\b/.test(n) ||
    /\bcurrent\s+time\b/.test(n) ||
    /\b(?:whats|what's|what)\s+(?:is\s+)?(?:the\s+)?time(?:\s+(?:is\s+)?(?:it|now))?\b/.test(n) ||
    /\btime\s+(?:right\s+)?now\b/.test(n)
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

function buildEntityColumnsHelp(): string {
  const catalog = getDataCatalog();
  const lines: string[] = [];
  for (const [name, entity] of Object.entries(catalog)) {
    const filterable = entity.filterableColumns.join(",");
    const readable = entity.readableColumns.slice(0, 6).join(",");
    const extra = entity.joins ? Object.values(entity.joins).map((j) => `${j.relation}(${j.select})`).join(" ") : "";
    lines.push(`- ${name}: filter=[${filterable}] select=[${readable}]${extra ? ` join=${extra}` : ""}`);
  }
  return lines.join("\n");
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

  if (isCurrentTimeQuestion(request.message)) {
    const content = buildCurrentTimeAnswer();
    await saveMessage(sessionId, "assistant", content, schoolId, {
      deterministic: true,
      type: "current_time",
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
