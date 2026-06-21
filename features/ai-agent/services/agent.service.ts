import type { AuthUser } from "@/types/auth";
import type { AgentChatRequest, AgentChatResponse, AgentPlan, AgentExecutionContext, AgentTool } from "@/features/ai-agent/types";
import { agentPlanSchema } from "@/features/ai-agent/validators/aiAgent.schema";
import { getProvider, AIProviderError } from "@/lib/ai/providers";
import { getAvailableToolsForUser, getToolNamesForUser } from "./tool-registry.service";
import { executeTool, ToolExecutionError } from "./tool-executor.service";
import { buildPageContext, sanitizeForAgent } from "./context-builder.service";
import { getDataCatalog } from "./data-catalog.service";
import { createSession, saveMessage, getLastMessages, getSession, updateSessionStatus, updateSessionMetadata } from "./memory.service";
import { logAgentAIEvent } from "./agent-audit.service";
import { classifyToolError, buildRetryPrompt, buildRetryExhaustedMessage, MAX_RETRY_ATTEMPTS } from "./retry.service";
import { shouldCompact, compactConversation } from "./compaction.service";

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
- If the user's question does not match any entity in the catalog (e.g. "roles", "permissions", "features", "system capabilities"), use "answer" intent and say "I don't have information about that" rather than trying to invent an entity name.
- For questions about user accounts or profiles (e.g. "how many user profiles", "list users"), use the "users" entity.
- Handle greetings and small talk politely and warmly. When the user says hello, hi, hey, good morning/afternoon/evening, or similar greetings, respond with a friendly greeting and ask how you can help.

## Plan Structure
Analyze requests and produce a JSON plan: intent ("answer"|"retrieve"|"act"|"clarify"|"refuse"), userGoal, toolName (or null), toolInput (or null), requiresConfirmation, riskLevel ("low"|"medium"|"high"|"critical"), reasoningSummary, userFacingMessage.

## Risk Levels
- Low: view/search/draft. Medium: create/update single records. High: finance/bulk ops/messaging. Critical: deletes/role changes/fee waivers/publishing/term changes.

## query_school_data
Available entities with their column schemas are listed in Entity Columns below. Use the correct filterable field names — e.g. staff position is "position", not "role". For name fields on staff, select from users join (first_name, last_name).
Operations: count (totals), list (records), summary (groupBy), exists. Always include relevant filters like status, is_published, date ranges. Read-only.

### Important: select and joins
When selecting columns for an entity that has a join (shown in Entity Columns as "join=relation(cols)"), do NOT include the foreign key column in your select. The join will provide the related data automatically. For example, for staff, do NOT include "user_id" in select — use the users join instead.

### Examples
User: "How many teachers?" → {"intent":"retrieve","toolName":"query_school_data","toolInput":{"entity":"staff","operation":"count","filters":[{"field":"status","operator":"eq","value":"active"}]}}
User: "Show absent students today" → {"intent":"retrieve","toolName":"query_school_data","toolInput":{"entity":"attendance","operation":"list","filters":[{"field":"date","operator":"eq","value":"CURRENT_DATE"},{"field":"status","operator":"eq","value":"absent"}],"select":["student_id","class_id","date","status"],"limit":100}}
User: "Unpaid fees?" → {"intent":"retrieve","toolName":"query_school_data","toolInput":{"entity":"student_fees","operation":"list","filters":[{"field":"balance","operator":"gt","value":0}],"select":["student_id","amount_due","amount_paid","balance","status"],"limit":100}}
User: "How many active students?" → {"intent":"retrieve","toolName":"query_school_data","toolInput":{"entity":"students","operation":"count","filters":[{"field":"status","operator":"eq","value":"active"}]}}
User: "Low attendance students" → {"intent":"retrieve","toolName":"query_school_data","toolInput":{"entity":"attendance","operation":"summary","filters":[{"field":"status","operator":"eq","value":"absent"}],"groupBy":["student_id"],"limit":100}}
User: "How many user profiles?" → {"intent":"retrieve","toolName":"query_school_data","toolInput":{"entity":"users","operation":"count"}}
User: "List all users" → {"intent":"retrieve","toolName":"query_school_data","toolInput":{"entity":"users","operation":"list","select":["user_id","first_name","last_name","email","role","status"],"limit":50}}
User: "hello" → {"intent":"answer","userGoal":"Greet the user","toolName":null,"toolInput":null,"requiresConfirmation":false,"riskLevel":"low","reasoningSummary":"User greeted the assistant","userFacingMessage":"Hello! Welcome to the CBC School Management System. How can I help you today?"}
User: "hi there" → {"intent":"answer","userGoal":"Greet the user","toolName":null,"toolInput":null,"requiresConfirmation":false,"riskLevel":"low","reasoningSummary":"User greeted the assistant","userFacingMessage":"Hi there! I'm your AI assistant. What can I help you with?"}`;

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

  const normalizedMessage = preProcessUserMessage(request.message);

  await saveMessage(sessionId, "user", normalizedMessage, schoolId, {
    pageContext: request.pageContext,
  });

  // Use normalized message for all downstream processing
  const originalMessage = request.message;
  request.message = normalizedMessage;

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

  const provider = getProvider();

  // ── Retry loop: plan → execute → on error, replan (max MAX_RETRY_ATTEMPTS) ──
  const previousPlans: Array<{ plan: string; error: string }> = [];

  for (let attempt = 1; attempt <= MAX_RETRY_ATTEMPTS; attempt += 1) {
    const retryContextStr = previousPlans.length > 0
      ? `\n\n## Previous Attempt (${attempt - 1})\n${buildRetryPrompt(request.message, previousPlans[previousPlans.length - 1].plan, previousPlans[previousPlans.length - 1].error, attempt, MAX_RETRY_ATTEMPTS)}`
      : "";

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
${buildEntityColumnsHelp(request.message)}

## Tools Available to You
${toolsDescription || "No tools available with your current permissions."}

## Recent Conversation
${conversationHistory || "No previous messages in this session."}

## User's New Request
${request.message}${retryContextStr}`;

    // Step 1: Plan
    let planResult: import("@/features/ai-agent/types").AIProviderResponse<AgentPlan | string>;
    try {
      planResult = await provider.generate<AgentPlan>({
        system: systemContext,
        prompt: previousPlans.length > 0
          ? `Your previous plan failed. Review the error below and produce a corrected plan. Original request: "${request.message}". Error: ${previousPlans[previousPlans.length - 1].error}`
          : `Analyze this request and produce a JSON plan with intent, toolName (if applicable), toolInput, requiresConfirmation, riskLevel, reasoningSummary, and userFacingMessage.`,
        responseFormat: "json",
        responseSchema: agentPlanSchema,
        requestLabel: "ai-agent.plan",
        temperature: 0.5,
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
      previousPlans.push({ plan: "(planning failed)", error: msg });
      if (attempt < MAX_RETRY_ATTEMPTS) {
        continue;
      }
      const isSchemaError = msg.includes("did not match schema") || msg.includes("invalid JSON");
      const userMessage = isSchemaError
        ? "I had trouble understanding your request. Please try rephrasing it more clearly."
        : "I encountered an issue while processing your request. Please try rephrasing.";
      await tryCompact(sessionId, schoolId);
      return buildErrorResponse(sessionId, userMessage);
    }

    if (!planResult.success) {
      if (previousPlans.length > 0) {
        previousPlans.push({ plan: "(plan result not successful)", error: "Model did not return a valid plan" });
        continue;
      }
      await tryCompact(sessionId, schoolId);
      return buildErrorResponse(sessionId, "Failed to analyze your request. Please try again.");
    }

    const plan = planResult.data as AgentPlan;

    // Non-tool intents — return immediately (no retry needed)
    if (plan.intent === "refuse" || plan.intent === "clarify" || plan.intent === "answer") {
      await saveMessage(sessionId, "assistant", plan.userFacingMessage, schoolId);
      await tryCompact(sessionId, schoolId);
      return {
        sessionId,
        message: { role: "assistant", content: plan.userFacingMessage },
        confidence: planResult.confidence,
        warnings: planResult.warnings ?? [],
      };
    }

    // Tool-based intent (retrieve or act)
    if (plan.intent === "retrieve" || plan.intent === "act") {
      if (!plan.toolName) {
        await saveMessage(sessionId, "assistant", plan.userFacingMessage, schoolId);
        await tryCompact(sessionId, schoolId);
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
        previousPlans.push({ plan: JSON.stringify(plan), error: msg });
        continue;
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

        // Confirmation needed — return immediately
        if (result.requiresConfirmation) {
          const msg = `${plan.userFacingMessage}\n\nI need your confirmation before proceeding. Please review the action details below.`;
          await saveMessage(sessionId, "assistant", msg, schoolId, {
            actionPreview: result.preview,
            actionId: result.actionId,
            requiresConfirmation: true,
          });
          await tryCompact(sessionId, schoolId);
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

        // Step 2: Generate user-friendly response with tool output
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

        // Check compaction after successful response
        await tryCompact(sessionId, schoolId);

        return {
          sessionId,
          message: { role: "assistant", content: answerText },
          confidence: responseResult.success ? responseResult.confidence : planResult.confidence,
          warnings: [...(planResult.warnings ?? []), ...(responseResult.warnings ?? [])],
        };
      } catch (error) {
        const classification = classifyToolError(error);
        previousPlans.push({ plan: JSON.stringify(plan), error: classification.message });

        if (classification.retryable && attempt < MAX_RETRY_ATTEMPTS) {
          continue;
        }

        // Exhausted retries or non-retryable error
        const userMessage = previousPlans.length >= MAX_RETRY_ATTEMPTS
          ? buildRetryExhaustedMessage(request.message, previousPlans)
          : classification.message;

        await saveMessage(sessionId, "assistant", `Error: ${userMessage}`, schoolId);

        await logAgentAIEvent({
          requestLabel: `ai-agent.tool.${plan.toolName}`,
          model: planResult.meta?.model ?? "unknown",
          schoolId,
          prompt: request.message,
          success: false,
          durationMs: Date.now() - startedAt,
          error: classification.message,
        });

        await tryCompact(sessionId, schoolId);
        return buildErrorResponse(sessionId, userMessage);
      }
    }
  }

  await tryCompact(sessionId, schoolId);
  return buildErrorResponse(sessionId, buildRetryExhaustedMessage(request.message, previousPlans));
}

function buildErrorResponse(sessionId: string, message: string): AgentChatResponse {
  return {
    sessionId,
    message: { role: "assistant", content: message },
    confidence: 0,
    warnings: [message],
  };
}

async function tryCompact(sessionId: string, schoolId: string): Promise<void> {
  try {
    const recent = await getLastMessages(sessionId, 20);
    if (shouldCompact(recent)) {
      const session = await getSession(sessionId);
      const existingSummary = session?.metadata?.compacted_summary as string | undefined;
      const result = await compactConversation(recent, existingSummary);
      await updateSessionMetadata(sessionId, {
        compacted_summary: result.summary,
        compacted_message_count: result.userMessageCount,
        last_compacted_at: new Date().toISOString(),
      });
    }
  } catch {
    // Compaction failure is non-critical — continue silently
  }
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

const SOCIAL_PATTERNS = [
  // Greetings
  [/^(?:hello|hi|hey|heyy|heya|howdy)\b/i, true],
  [/\b(?:good\s+(?:morning|afternoon|evening|day)|greetings|sup|yo)\b/i, true],
  [/^nice\s+to\s+(?:meet|see)\s+(?:you|ya)\b/i, true],
  [/^what'?s?\s+up\b/i, true],
  // Wellbeing checks
  [/^(?:how\s+are\s+you|how're\s+you|how\s+are\s+things|how's\s+it\s+going|you\s+okay|are\s+you\s+okay|are\s+you\s+ok|u\s+ok|you\s+alright|everything\s+okay)\s*\??$/i, true],
  [/^(?:how\s+(?:are|do)\s+you\s+(?:feel|do|doing))\s*\??$/i, true],
  // Single-word pleasantries
  [/^(?:thanks|thank\s+you|thankyou|ty|thx|ok|okay|k|sure|alright|fine|good|great|nice|cool|awesome|perfect|welcome|yw|np)$/i, true],
  // Short vague inputs that aren't data queries
  [/^(?:yeah|yes|no|nope|yep|nah|maybe|idk|dunno|sure|whatever)$/i, true],
];

function isSocialQuery(message: string): boolean {
  const n = message.trim().toLowerCase();
  return SOCIAL_PATTERNS.some(([pattern]) => (pattern as RegExp).test(n));
}

function handleGreeting(message: string): string | null {
  if (isSocialQuery(message)) {
    const hour = new Date().getHours();
    const timeGreeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
    const n = message.trim().toLowerCase();
    const isThankYou = /^(?:thanks|thank\s+you|thankyou|ty|thx)$/i.test(n);
    const isWellbeing = /^(?:how\s+are\s+you|are\s+you\s+okay|you\s+okay|you\s+alright|how're\s+you|how\s+are\s+things|how's\s+it\s+going|how\s+are\s+you\s+(?:feeling|doing)|are\s+you\s+ok)\s*\??$/i.test(n);
    if (isThankYou) {
      return "You're welcome! Let me know if you need anything else.";
    }
    if (isWellbeing) {
      const responses = [
        "I'm doing great, thank you for asking! How can I help you with the school management system today?",
        "I'm functioning well! Ready to assist you. What do you need?",
        "All good here! What can I help you with?",
      ];
      return responses[Math.floor(Math.random() * responses.length)];
    }
    const responses = [
      `${timeGreeting}! I'm the CBC School Management AI assistant. How can I help you today?`,
      `Hi there! Welcome back. What would you like to work on in the system?`,
      `Hello! I'm here to help you with the school management system. What do you need?`,
    ];
    return responses[Math.floor(Math.random() * responses.length)];
  }
  return null;
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

/**
 * Normalize common typos and misspellings in user input so the model
 * has a better chance of understanding the intent.
 */
function preProcessUserMessage(message: string): string {
  let text = message.trim();

  // "okay how many" → "how many" (most common typo pattern)
  text = text.replace(/\bokay\s+(how|many|what|who|where|when|why|is|are|can|do|does)\b/i, "$1");

  // "alot" → "a lot"
  text = text.replace(/\balot\b/gi, "a lot");

  // "dont/cant/wont/isnt" → "don't/can't/won't/isn't"
  text = text.replace(/\b(dont|cant|wont|isnt|wasnt|werent|havent|hasnt|didnt|couldnt|wouldnt|shouldnt)\b/gi,
    (m) => m.slice(0, -2) + "'t");

  // "u" → "you" (common textism)
  text = text.replace(/\b(?<![a-z])u(?![a-z])\b/gi, "you");

  // "pls/plz" → "please"
  text = text.replace(/\b(pls|plz)\b/gi, "please");

  return text;
}

function buildEntityColumnsHelp(message?: string): string {
  const catalog = getDataCatalog();
  const names = Object.keys(catalog);
  const isDataQuery = message
    ? /\b(how many|count|total|list|show|display|find|search|who|what|which|students?|fees?|attendance|staff|teachers?|classes|assessments?|reports?|payments?|balances?|dues?|profiles?|users?|roles?|permissions?|subjects?|timetable|schedule|lesson|exam|result|grade|score|discipline|incident|message|announcement|audit)\b/i.test(message)
    : true;
  if (!isDataQuery) {
    return names.length > 0 ? `Available entities: ${names.slice(0, 20).join(", ")}.` : "No entities available.";
  }
  const lines: string[] = [];
  for (const [name, entity] of Object.entries(catalog)) {
    const readable = entity.readableColumns.slice(0, 3).join(",");
    const extra = entity.joins ? Object.values(entity.joins).map((j) => `${j.relation}(${j.select})`).join(" ") : "";
    lines.push(`- ${name}: select=[${readable}]${extra ? ` join=${extra}` : ""}`);
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

  const greetingResponse = handleGreeting(request.message);
  if (greetingResponse) {
    const content = greetingResponse;
    await saveMessage(sessionId, "assistant", content, schoolId, {
      deterministic: true,
      type: "greeting",
    });
    return {
      sessionId,
      message: { role: "assistant", content },
      confidence: 1,
      warnings: [],
    };
  }

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
