import { createSupabaseServerClient } from "@/lib/supabase/server";
import { hasPermission } from "@/lib/auth/permissions";
import type { AuthUser } from "@/types/auth";
import type { AgentTool, AgentExecutionContext, RiskLevel } from "@/features/ai-agent/types";
import { findTool } from "./tool-registry.service";
import { logAgentAction, updateActionStatus, writeAgentAuditLog, logAgentAIEvent } from "./agent-audit.service";
import { sanitizeForAgent } from "./context-builder.service";
import { requiresConfirmation as checkConfirmationRequired } from "./policy.service";

export class ToolExecutionError extends Error {
  readonly toolName: string;
  readonly statusCode?: number;

  constructor(message: string, toolName: string, statusCode?: number) {
    super(message);
    this.name = "ToolExecutionError";
    this.toolName = toolName;
    this.statusCode = statusCode;
  }
}

export async function executeTool(
  toolName: string,
  input: Record<string, unknown>,
  context: AgentExecutionContext,
): Promise<{ output: Record<string, unknown>; actionId: string; requiresConfirmation: boolean; preview: Record<string, unknown> }> {
  const tool = findTool(toolName);
  if (!tool) throw new ToolExecutionError(`Unknown tool: ${toolName}`, toolName);

  const { user, schoolId, sessionId } = context;

  if (!hasPermission(user.role, tool.module, tool.action)) {
    throw new ToolExecutionError(`You do not have ${tool.action} permission on ${tool.module}`, toolName);
  }

  const validation = tool.inputSchema.safeParse(input);
  if (!validation.success) {
    throw new ToolExecutionError(
      `Invalid input: ${validation.error.issues.map((i) => i.message).join("; ")}`,
      toolName,
    );
  }

  const needsConfirmation = checkConfirmationRequired(tool, validation.data, user);

  const actionId = await logAgentAction({
    sessionId,
    schoolId,
    userId: user.id,
    toolName: tool.name,
    module: tool.module,
    permissionAction: tool.action,
    riskLevel: tool.riskLevel,
    status: needsConfirmation ? "awaiting_confirmation" : "approved",
    input: input as Record<string, unknown>,
    requiresConfirmation: needsConfirmation,
  });

  const preview = buildPreview(tool, validation.data);

  if (needsConfirmation) {
    return { output: {}, actionId, requiresConfirmation: true, preview };
  }

  const result = await runExecution(tool, validation.data, context, actionId);

  return { output: result, actionId, requiresConfirmation: false, preview: {} };
}

async function runExecution(
  tool: AgentTool,
  validatedInput: unknown,
  context: AgentExecutionContext,
  actionId: string,
): Promise<Record<string, unknown>> {
  const { user, schoolId } = context;
  const startedAt = Date.now();

  await updateActionStatus(actionId, "executing");

  try {
    const output = await tool.execute(validatedInput, context);

    const safeOutput = sanitizeForAgent(output as Record<string, unknown>) as Record<string, unknown>;

    await updateActionStatus(actionId, "completed", { output: safeOutput });

    if (tool.riskLevel !== "low") {
      await writeAgentAuditLog({
        schoolId: context.schoolId,
        action: "AI_AGENT_EXECUTE",
        performedBy: user.id,
        details: {
          toolName: tool.name,
          actionId,
          sessionId: context.sessionId,
          riskLevel: tool.riskLevel,
        },
      });
    }

    return safeOutput;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown tool execution error";
    await updateActionStatus(actionId, "failed", { error: errorMessage });
    throw new ToolExecutionError(errorMessage, tool.name);
  }
}

export async function executeConfirmedAction(
  actionId: string,
  user: AuthUser,
): Promise<Record<string, unknown>> {
  const supabase = await createSupabaseServerClient();
  const { data: action } = await supabase
    .from("ai_agent_actions")
    .select("*")
    .eq("action_id", actionId)
    .maybeSingle();

  if (!action) throw new ToolExecutionError("Action not found", "unknown");
  if (action.status !== "awaiting_confirmation") throw new ToolExecutionError(`Action is in status "${action.status}", not awaiting confirmation`, action.tool_name);
  if (action.user_id !== user.id) throw new ToolExecutionError("This action belongs to another user", action.tool_name);
  if (action.school_id !== user.schoolId) throw new ToolExecutionError("School mismatch", action.tool_name);

  if (!hasPermission(user.role, action.module, action.permission_action)) {
    throw new ToolExecutionError("Permissions have changed since this action was planned", action.tool_name);
  }

  const tool = findTool(action.tool_name);
  if (!tool) throw new ToolExecutionError(`Tool "${action.tool_name}" no longer exists`, action.tool_name);

  await updateActionStatus(actionId, "approved", { confirmedBy: user.id });

  const context: AgentExecutionContext = {
    user,
    schoolId: user.schoolId!,
    sessionId: action.session_id,
    actionId,
    requestId: `confirm-${actionId}`,
  };

  const validation = tool.inputSchema.safeParse(action.input);
  if (!validation.success) {
    throw new ToolExecutionError("Action input is no longer valid", tool.name);
  }

  return runExecution(tool, validation.data, context, actionId);
}

function buildPreview(tool: AgentTool, input: unknown): Record<string, unknown> {
  if (tool.riskLevel === "low") return {};
  return {
    tool: tool.name,
    description: tool.description,
    riskLevel: tool.riskLevel,
    input: input as Record<string, unknown>,
    module: tool.module,
    action: tool.action,
  };
}
