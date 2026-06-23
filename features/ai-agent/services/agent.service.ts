import type { AuthUser } from "@/types/auth";
import type { AgentChatRequest, AgentChatResponse, AgentPlan, AgentExecutionContext, AgentTool } from "@/features/ai-agent/types";
import { agentPlanSchema } from "@/features/ai-agent/validators/aiAgent.schema";
import { getProvider, AIProviderError } from "@/lib/ai/providers";
import { getAvailableToolsForUser, getToolNamesForUser } from "./tool-registry.service";
import { executeTool, ToolExecutionError } from "./tool-executor.service";
import { buildPageContext, sanitizeForAgent } from "./context-builder.service";

import { getDbSchema, formatSchemaForPrompt } from "./db-schema.service";
import { createSession, saveMessage, getLastMessages, getSession, updateSessionStatus, updateSessionMetadata } from "./memory.service";
import { logAgentAIEvent } from "./agent-audit.service";
import { classifyToolError, buildRetryPrompt, buildRetryExhaustedMessage, MAX_RETRY_ATTEMPTS } from "./retry.service";
import { shouldCompact, compactConversation } from "./compaction.service";

const SYSTEM_PROMPT = `You are a helpful AI assistant with broad general knowledge, specialized in the CBC School Management System.

## Personality
Be warm, friendly, and conversational. You have general knowledge about any topic — answer naturally. Your school management expertise is a specialty, not your only capability.

## How to Handle Requests

### General conversation / world knowledge
intent: "answer", toolName: null. Answer from your training. Examples: hello, tell me a joke, what's the capital of France, how are you, explain photosynthesis.

### School data queries
The database schema is provided in the ## Database Schema section below. Use execute_sql to write a PostgreSQL SELECT query and get the data. The SQL analyzer will add LIMIT and safety checks automatically. You can JOIN tables, filter, group, order — full SQL flexibility.

### School actions (create, update, send)
intent: "act" with the appropriate tool from the available tools list.

### When you don't know or need more info
intent: "clarify" to ask for more details.

### When the request is outside your role permissions
intent: "refuse" politely and mention what you CAN help with.

## Plan Structure
Always respond with JSON: { "intent": "answer"|"retrieve"|"act"|"clarify"|"refuse", "userGoal": "...", "toolName": null|"...", "toolInput": null|{...}, "requiresConfirmation": false, "riskLevel": "low"|"medium"|"high"|"critical", "reasoningSummary": "...", "userFacingMessage": "..." }

## Rules
- NEVER invent data. Only use information returned by tools or provided in Current Context.
- The current date and time are in Current Context below.
- Keep role confidentiality. Do not expose data the user cannot see.
- Prefer summaries over raw row-level data unless the user asks for specifics.
- Do NOT use markdown formatting. Plain text only.

## Risk Levels
Low: view/search/draft. Medium: create/update single records. High: finance/bulk ops/messaging. Critical: deletes/role changes/fee waivers/publishing/term changes.`;

const DEFAULT_AGENT_TIME_ZONE = process.env.AI_AGENT_TIMEZONE ?? "Europe/London";

export async function processAgentMessage(
  request: AgentChatRequest,
  user: AuthUser,
): Promise<AgentChatResponse> {
  const startedAt = Date.now();
  const schoolId = user.schoolId ?? "";

  let sessionId = request.sessionId?.trim();

  if (sessionId) {
    let existing = null;
    try {
      existing = await getSession(sessionId);
    } catch {
      // Transient error — try once more before falling back
      try { existing = await getSession(sessionId); } catch { /* give up */ }
    }
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

  const provider = getProvider();

  // ── Pre-load database schema (so the model doesn't need a two-step chain) ──
  let preloadedSchema: string | null = null;
  let preloadedSchemaSummary: string | null = null;
  try {
    const schemaResult = await getDbSchema();
    if (schemaResult.success && schemaResult.tables.length > 0) {
      preloadedSchema = formatSchemaForPrompt(schemaResult.tables);
      preloadedSchemaSummary = `Database has ${schemaResult.tables.length} tables`;
    }
  } catch {
    // Schema pre-load failed — fall through, get_db_schema tool remains available
  }

  // Filter get_db_schema from tools when schema is already loaded
  const toolsForModel = preloadedSchema
    ? availableTools.filter((t) => t.name !== "get_db_schema")
    : availableTools;

  const toolsDescription = toolsForModel
    .map((t) => `- ${t.name}: ${t.description} [${t.module}/${t.action}] (risk: ${t.riskLevel})`)
    .join("\n");

  // ── Multi-round tool chain: plan → execute → replan → execute → ... → respond ──
  // Each round can retry on error (MAX_RETRY_ATTEMPTS per round)
  const MAX_TOOL_ROUNDS = 3;
  const previousPlans: Array<{ plan: string; error: string }> = [];
  const toolChainResults: Array<{ toolName: string; output: string }> = [];

  for (let round = 1; round <= MAX_TOOL_ROUNDS; round += 1) {
    const hasPriorTools = toolChainResults.length > 0;
    const priorToolsStr = hasPriorTools
      ? `\n\n## Prior Tool Results\n${toolChainResults.map((r) => `- ${r.toolName}: ${r.output.slice(0, 3000)}`).join("\n")}`
      : "";

    for (let attempt = 1; attempt <= MAX_RETRY_ATTEMPTS; attempt += 1) {
      const retryContextStr = previousPlans.length > 0
        ? `\n\n## Previous Attempt (${attempt - 1})\n${buildRetryPrompt(request.message, previousPlans[previousPlans.length - 1].plan, previousPlans[previousPlans.length - 1].error, attempt, MAX_RETRY_ATTEMPTS)}`
        : "";

      const chainContextStr = hasPriorTools && attempt === 1
        ? `\n\nYou already called: ${toolChainResults.map((r) => r.toolName).join(" → ")}.\nThe user asked for: "${request.message}".\nCheck if the prior tool results directly contain the specific records or values the user asked for (e.g. names, counts, lists of people). If the results only contain metadata, schema structure, or partial information, you MUST call another tool to get what the user actually wants. Only set intent "answer" when the prior tool results already include the exact information requested.`
        : "";

      const schemaSection = preloadedSchema
        ? `\n## Database Schema\n${preloadedSchemaSummary}\n\n${preloadedSchema}\n`
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
- Current Module: ${pageContext.currentModule ?? "N/A"}${schemaSection}
## Tools Available to You
${toolsDescription || "No tools available with your current permissions."}

## Recent Conversation
${conversationHistory || "No previous messages in this session."}

## User's New Request
${request.message}${priorToolsStr}${chainContextStr}${retryContextStr}`;

      // Step 1: Plan
      let planResult: import("@/features/ai-agent/types").AIProviderResponse<AgentPlan | string>;
      try {
        const planPrompt = toolChainResults.length > 0
          ? `You already called: ${toolChainResults.map((r) => r.toolName).join(" → ")}.\nOriginal request: "${request.message}".\nThe prior tool results contain intermediate data — not the actual records the user asked for yet. Call execute_sql with a PostgreSQL query to retrieve the real data. Only set intent "answer" when the exact requested information (names, rows, values) is already in the prior results.`
          : previousPlans.length > 0
            ? `Your previous plan failed. Review the error below and produce a corrected plan. Original request: "${request.message}". Error: ${previousPlans[previousPlans.length - 1].error}`
            : preloadedSchema
              ? `The database schema is already loaded above. Write a PostgreSQL SELECT query and call execute_sql to retrieve the data. Use intent "retrieve" with toolName "execute_sql" and toolInput containing your query.`
              : `The database schema is NOT pre-loaded. Call get_db_schema first to discover the structure, then call execute_sql with a PostgreSQL SELECT query.`;

        planResult = await provider.generate<AgentPlan>({
          system: systemContext,
          prompt: planPrompt,
          responseFormat: "json",
          responseSchema: agentPlanSchema,
          requestLabel: "ai-agent.plan",
          temperature: 0.5,
          maxOutputTokens: 1000,
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Unexpected error during planning";
        await logAgentAIEvent({ requestLabel: "ai-agent.plan", model: "unknown", schoolId, prompt: request.message, success: false, durationMs: Date.now() - startedAt, error: msg });
        previousPlans.push({ plan: "(planning failed)", error: msg });
        if (attempt < MAX_RETRY_ATTEMPTS) continue;
        await tryCompact(sessionId, schoolId);
        const userMessage = buildConversationalFallback(request.message);
        await saveMessage(sessionId, "assistant", userMessage, schoolId);
        return { sessionId, message: { role: "assistant", content: userMessage }, confidence: 0, warnings: [] };
      }

      if (!planResult.success) {
        previousPlans.push({ plan: "(plan result not successful)", error: "Model did not return a valid plan" });
        continue;
      }

      const plan = planResult.data as AgentPlan;

      // Non-tool intents — assemble all chain results and respond
      if (plan.intent === "refuse" || plan.intent === "clarify" || plan.intent === "answer" || !plan.toolName) {
        if (toolChainResults.length > 0) {
          // If the chain only has schema (no actual data), ANY non-tool intent is premature —
          // reject it and force a retry with execute_sql
          if (toolChainResults.every((r) => r.toolName === "get_db_schema")) {
            previousPlans.push({
              plan: JSON.stringify(plan),
              error: `You set intent "${plan.intent}" but the chain only has database schema — not the actual records the user asked for. You MUST call execute_sql with a SELECT query to retrieve the real data. Do NOT ask for clarification or refuse — you have the tools you need. Call execute_sql now. Only use non-tool intents when the prior results contain the exact requested information (names, rows, values).`,
            });
            continue;
          }
          const chainSummary = toolChainResults.map((r) => `Tool "${r.toolName}" result: ${r.output}`).join("\n");
          const responseResult = await provider.generate({
            system: `You are a helpful school assistant. Explain the following result to the user in a clear, friendly way. Keep it concise. Do not invent additional information. Do NOT use markdown formatting. The following tools are available: ${toolsDescription}. If the current results don't fully answer the user's question, you can mention what additional information could be retrieved.`,
            prompt: `The user asked: "${request.message}"\n\nHere are the tool results:\n${chainSummary}\n\nExplain these results to the user in a natural way.`,
            responseFormat: "text",
            requestLabel: "ai-agent.answer",
            temperature: 0.5,
            maxOutputTokens: 800,
          });
          const answerText = responseResult.success ? (responseResult.data as string) : plan.userFacingMessage;
          await saveMessage(sessionId, "assistant", answerText, schoolId, { chainResults: toolChainResults });
          const durationMs = Date.now() - startedAt;
          await logAgentAIEvent({ requestLabel: "ai-agent.chain", model: planResult.meta?.model ?? "unknown", schoolId, prompt: request.message, response: answerText, success: true, durationMs });
          await tryCompact(sessionId, schoolId);
          return { sessionId, message: { role: "assistant", content: answerText }, confidence: planResult.confidence, warnings: planResult.warnings ?? [] };
        }
        await saveMessage(sessionId, "assistant", plan.userFacingMessage, schoolId);
        await tryCompact(sessionId, schoolId);
        return { sessionId, message: { role: "assistant", content: plan.userFacingMessage }, confidence: planResult.confidence, warnings: planResult.warnings ?? [] };
      }

      // Tool-based intent (retrieve or act)
      if (plan.intent === "retrieve" || plan.intent === "act") {
        if (!plan.toolName) {
          await saveMessage(sessionId, "assistant", plan.userFacingMessage, schoolId);
          await tryCompact(sessionId, schoolId);
          return { sessionId, message: { role: "assistant", content: plan.userFacingMessage }, confidence: planResult.confidence, warnings: planResult.warnings ?? [] };
        }

        const tool = availableTools.find((t) => t.name === plan.toolName);
        if (!tool) {
          const msg = `I cannot use "${plan.toolName}" — it is not available with your current permissions. ${plan.userFacingMessage}`;
          previousPlans.push({ plan: JSON.stringify(plan), error: msg });
          continue;
        }

        const context: AgentExecutionContext = {
          user, schoolId, sessionId,
          requestId: `chat-${sessionId}-${Date.now()}`,
        };

        try {
          const result = await executeTool(plan.toolName, (plan.toolInput ?? {}) as Record<string, unknown>, context);

          // Confirmation needed — return immediately (break chain)
          if (result.requiresConfirmation) {
            const msg = `${plan.userFacingMessage}\n\nI need your confirmation before proceeding.`;
            await saveMessage(sessionId, "assistant", msg, schoolId, { actionPreview: result.preview, actionId: result.actionId, requiresConfirmation: true });
            await tryCompact(sessionId, schoolId);
            return { sessionId, message: { role: "assistant", content: msg }, action: { actionId: result.actionId, status: "awaiting_confirmation", preview: result.preview as Record<string, unknown>, riskLevel: plan.riskLevel, requiresConfirmation: true }, confidence: planResult.confidence, warnings: planResult.warnings ?? [] };
          }

          // Store result and continue to next tool round
          const outputStr = formatToolOutput(result.output);
          toolChainResults.push({ toolName: plan.toolName, output: outputStr });
          break; // Exit retry loop, continue to next tool round
        } catch (error) {
          const classification = classifyToolError(error);
          previousPlans.push({ plan: JSON.stringify(plan), error: classification.message });

          if (classification.retryable && attempt < MAX_RETRY_ATTEMPTS) continue;

          const userMessage = previousPlans.length >= MAX_RETRY_ATTEMPTS
            ? buildRetryExhaustedMessage(request.message, previousPlans)
            : classification.message;

          await saveMessage(sessionId, "assistant", `Error: ${userMessage}`, schoolId);
          await logAgentAIEvent({ requestLabel: `ai-agent.tool.${plan.toolName}`, model: planResult.meta?.model ?? "unknown", schoolId, prompt: request.message, success: false, durationMs: Date.now() - startedAt, error: classification.message });
          await tryCompact(sessionId, schoolId);
          return buildErrorResponse(sessionId, userMessage);
        }
      }
    }
  }

  // Exhausted all tool rounds — generate final response from what we have
  if (toolChainResults.length > 0) {
    const chainSummary = toolChainResults.map((r) => `Tool "${r.toolName}" result: ${r.output}`).join("\n");
    const responseResult = await provider.generate({
      system: `You are a helpful school assistant. Explain the following result to the user in a clear, friendly way. Keep it concise. Do not invent additional information. Do NOT use markdown formatting. The following tools are available: ${toolsDescription}.`,
      prompt: `The user asked: "${request.message}"\n\nHere are the tool results:\n${chainSummary}\n\nExplain these results to the user.`,
      responseFormat: "text",
      requestLabel: "ai-agent.chain",
      temperature: 0.5,
      maxOutputTokens: 800,
    });
    const answerText = responseResult.success ? (responseResult.data as string) : "I ran some queries but could not find the information you need.";
    await saveMessage(sessionId, "assistant", answerText, schoolId, { chainResults: toolChainResults });
    await tryCompact(sessionId, schoolId);
    return { sessionId, message: { role: "assistant", content: answerText }, confidence: responseResult.success ? responseResult.confidence : 0, warnings: responseResult.warnings ?? [] };
  }

  await tryCompact(sessionId, schoolId);
  return buildErrorResponse(sessionId, buildRetryExhaustedMessage(request.message, previousPlans));
}

function formatToolOutput(output: unknown): string {
  if (typeof output === "string") return output;
  if (output && typeof output === "object" && !Array.isArray(output)) {
    const obj = output as Record<string, unknown>;
    if (typeof obj.summary === "string") {
      if (typeof obj.schema === "string") {
        return `${obj.summary}\n\n${obj.schema}`;
      }
      const errorText = typeof obj.error === "string" && obj.error ? `: ${obj.error}` : "";
      let result = `${obj.summary}${errorText}`;

      if (Array.isArray(obj.rows) && obj.rows.length > 0) {
        const sample = obj.rows.slice(0, 20).map((r: unknown, i: number) => {
          const row = r as Record<string, unknown>;
          return `${i + 1}. ${Object.entries(row).map(([k, v]) => `${k}: ${v}`).join(", ")}`;
        }).join("\n");
        result += `\n\nRows:\n${sample}`;
        if (obj.rows.length > 20) result += `\n... and ${obj.rows.length - 20} more row(s)`;
      }

      if (obj.details !== undefined) {
        const details = obj.details;
        if (Array.isArray(details)) {
          const sample = details.slice(0, 20).map((item: unknown, i: number) => {
            if (item !== null && typeof item === "object") {
              return `${i + 1}. ${Object.entries(item as Record<string, unknown>).map(([k, v]) => `${k}: ${v}`).join(", ")}`;
            }
            return `${i + 1}. ${item}`;
          }).join("\n");
          result += `\n\nDetails:\n${sample}`;
          if (details.length > 20) result += `\n... and ${details.length - 20} more`;
        } else if (details !== null && typeof details === "object") {
          const str = JSON.stringify(details);
          result += `\n\nDetails: ${str.length > 2000 ? str.slice(0, 2000) + "..." : str}`;
        } else {
          result += `\n\nDetails: ${details}`;
        }
      }

      return result;
    }
  }
  return JSON.stringify(output, null, 2);
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

function buildConversationalFallback(message: string): string {
  const n = message.trim().toLowerCase();
  if (/^(?:how\s+are\s+you|are\s+you\s+(?:ok|okay)\s*)\??$/i.test(n)) {
    const responses = [
      "I'm doing well! I'm here to help you with the school management system. You can ask me about students, attendance, fees, grades, or anything else school-related. What would you like to know?",
      "I'm great, thanks for asking! I can help you manage students, track attendance, view fee records, check grades, and more. What do you need help with?",
    ];
    return responses[Math.floor(Math.random() * responses.length)];
  }
  const fallbacks = [
    "I'm here to help you manage the school system. You can ask me about students, attendance, fees, report cards, timetables, or any other school management task. What would you like to do?",
    "I'm your AI assistant for the school management system. I can help you look up information, generate reports, draft messages, and more. What are you working on?",
    "I'm ready to help! I can answer questions about student records, attendance data, fee balances, academic performance, and other school operations. What would you like me to look into?",
  ];
  return fallbacks[Math.floor(Math.random() * fallbacks.length)];
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

const GREETING_PATTERNS = [
  /^(?:hello|hi|hey|heyy|heya|howdy)\b/i,
  /\b(?:good\s+(?:morning|afternoon|evening|day)|greetings)\b/i,
];

function handleGreeting(message: string): string | null {
  const n = message.trim().toLowerCase();
  if (GREETING_PATTERNS.some((p) => p.test(n))) {
    const stripped = n.replace(/^(?:hello|hi|hey|heyy|heya|howdy)\b\s*,*\s*/i, "")
      .replace(/^(?:good\s+(?:morning|afternoon|evening|day)|greetings)\b\s*,*\s*/i, "")
      .trim();
    if (stripped.length > 0 && !/^[!.,;:?]+$/.test(stripped)) return null;
    const hour = new Date().getHours();
    const timeGreeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
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
