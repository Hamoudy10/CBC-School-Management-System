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
- If a user asks about something outside their role's modules, politely refuse and mention what modules they DO have access to.`;

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
