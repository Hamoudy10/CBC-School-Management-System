import { createSupabaseServerClient } from "@/lib/supabase/server";
import { writeAuditLog } from "@/services/audit.service";
import { logAIEvent } from "@/lib/ai/ai.logger";

export async function logAgentAction(params: {
  sessionId: string;
  schoolId: string | null;
  userId: string;
  toolName: string;
  module: string;
  permissionAction: string;
  riskLevel: string;
  status: string;
  input: Record<string, unknown>;
  output?: Record<string, unknown> | null;
  error?: string | null;
  requiresConfirmation?: boolean;
  confirmedBy?: string | null;
  confirmedAt?: string | null;
}): Promise<string> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("ai_agent_actions")
    .insert({
      session_id: params.sessionId,
      school_id: params.schoolId,
      user_id: params.userId,
      tool_name: params.toolName,
      module: params.module,
      permission_action: params.permissionAction,
      risk_level: params.riskLevel,
      status: params.status,
      input: params.input,
      output: params.output ?? null,
      error: params.error ?? null,
      requires_confirmation: params.requiresConfirmation ?? false,
      confirmed_by: params.confirmedBy ?? null,
      confirmed_at: params.confirmedAt ?? null,
    })
    .select("action_id")
    .single();

  if (error) throw new Error(`Failed to log agent action: ${error.message}`);
  return data.action_id;
}

export async function updateActionStatus(
  actionId: string,
  status: string,
  updates?: { output?: Record<string, unknown>; error?: string; confirmedBy?: string },
): Promise<void> {
  const supabase = await createSupabaseServerClient();
  const dbUpdates: Record<string, unknown> = {
    status,
    updated_at: new Date().toISOString(),
  };
  if (updates?.output) dbUpdates.output = updates.output;
  if (updates?.error) dbUpdates.error = updates.error;
  if (updates?.confirmedBy) {
    dbUpdates.confirmed_by = updates.confirmedBy;
    dbUpdates.confirmed_at = new Date().toISOString();
  }
  await supabase.from("ai_agent_actions").update(dbUpdates).eq("action_id", actionId);
}

export async function getAction(
  actionId: string,
): Promise<{
  actionId: string;
  sessionId: string;
  schoolId: string | null;
  userId: string;
  toolName: string;
  module: string;
  permissionAction: string;
  riskLevel: string;
  status: string;
  input: Record<string, unknown>;
  output: Record<string, unknown> | null;
  error: string | null;
  requiresConfirmation: boolean;
  confirmedBy: string | null;
  createdAt: string;
  expiresAt: string | null;
} | null> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("ai_agent_actions")
    .select("*")
    .eq("action_id", actionId)
    .maybeSingle();

  if (!data) return null;

  return {
    actionId: data.action_id,
    sessionId: data.session_id,
    schoolId: data.school_id,
    userId: data.user_id,
    toolName: data.tool_name,
    module: data.module,
    permissionAction: data.permission_action,
    riskLevel: data.risk_level,
    status: data.status,
    input: data.input,
    output: data.output,
    error: data.error,
    requiresConfirmation: data.requires_confirmation,
    confirmedBy: data.confirmed_by,
    createdAt: data.created_at,
    expiresAt: data.expires_at,
  };
}

export async function logAgentAIEvent(params: {
  requestLabel: string;
  model: string;
  schoolId?: string;
  prompt: string;
  response?: string;
  success: boolean;
  durationMs: number;
  usage?: { promptTokens?: number; completionTokens?: number; totalTokens?: number };
  error?: string;
}): Promise<void> {
  await logAIEvent({
    requestLabel: params.requestLabel,
    model: params.model,
    schoolId: params.schoolId,
    prompt: params.prompt,
    response: params.response,
    success: params.success,
    cached: false,
    durationMs: params.durationMs,
    usage: params.usage,
    warnings: params.error ? [params.error] : [],
    error: params.error,
  });
}

export async function writeAgentAuditLog(params: {
  schoolId?: string;
  action: string;
  performedBy: string;
  details?: Record<string, unknown>;
}): Promise<void> {
  await writeAuditLog({
    schoolId: params.schoolId,
    tableName: "ai_agent_actions",
    action: params.action as any,
    performedBy: params.performedBy,
    details: params.details,
  });
}
