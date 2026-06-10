import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { SessionMode, SessionStatus, MessageRole, SessionSummary } from "@/features/ai-agent/types";

export interface StoredMessage {
  messageId: string;
  sessionId: string;
  role: MessageRole;
  content: string;
  structuredPayload?: Record<string, unknown>;
  createdAt: string;
}

export async function createSession(
  userId: string,
  schoolId: string | null,
  mode: SessionMode = "assist",
  title?: string,
): Promise<string> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("ai_agent_sessions")
    .insert({
      user_id: userId,
      school_id: schoolId,
      mode,
      title: title ?? `Session ${new Date().toLocaleDateString()}`,
    })
    .select("session_id")
    .single();

  if (error) throw new Error(`Failed to create session: ${error.message}`);
  return data.session_id;
}

export async function getSession(sessionId: string): Promise<{
  sessionId: string;
  userId: string;
  schoolId: string | null;
  mode: SessionMode;
  status: SessionStatus;
  title: string;
  createdAt: string;
  metadata?: Record<string, unknown>;
} | null> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("ai_agent_sessions")
    .select("*")
    .eq("session_id", sessionId)
    .maybeSingle();

  if (!data) return null;

  return {
    sessionId: data.session_id,
    userId: data.user_id,
    schoolId: data.school_id,
    mode: data.mode,
    status: data.status,
    title: data.title,
    createdAt: data.created_at,
    metadata: data.metadata,
  };
}

export async function listUserSessions(
  userId: string,
  schoolId: string | null,
  limit = 20,
): Promise<SessionSummary[]> {
  const supabase = await createSupabaseServerClient();
  const query = supabase
    .from("ai_agent_sessions")
    .select("*, ai_agent_messages(count)")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (schoolId) query.eq("school_id", schoolId);

  const { data } = await query;

  if (!data) return [];

  return data.map((row: any) => ({
    sessionId: row.session_id,
    title: row.title,
    mode: row.mode,
    status: row.status,
    messageCount: row.ai_agent_messages?.[0]?.count ?? 0,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));
}

export async function updateSessionStatus(
  sessionId: string,
  status: SessionStatus,
  title?: string,
): Promise<void> {
  const supabase = await createSupabaseServerClient();
  const updates: Record<string, unknown> = { status, updated_at: new Date().toISOString() };
  if (title) updates.title = title;
  await supabase.from("ai_agent_sessions").update(updates).eq("session_id", sessionId);
}

export async function updateSessionMetadata(
  sessionId: string,
  metadata: Record<string, unknown>,
): Promise<void> {
  const supabase = await createSupabaseServerClient();
  const { data: existing } = await supabase
    .from("ai_agent_sessions")
    .select("metadata")
    .eq("session_id", sessionId)
    .maybeSingle();

  const merged = { ...(existing?.metadata as Record<string, unknown> ?? {}), ...metadata };
  await supabase
    .from("ai_agent_sessions")
    .update({ metadata: merged, updated_at: new Date().toISOString() })
    .eq("session_id", sessionId);
}

export async function saveMessage(
  sessionId: string,
  role: MessageRole,
  content: string,
  schoolId?: string | null,
  structuredPayload?: Record<string, unknown> | null,
): Promise<string> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from("ai_agent_messages")
    .insert({
      session_id: sessionId,
      role,
      content,
      school_id: schoolId,
      structured_payload: structuredPayload ?? null,
    })
    .select("message_id")
    .single();

  if (error) throw new Error(`Failed to save message: ${error.message}`);
  return data.message_id;
}

export async function getSessionMessages(
  sessionId: string,
  limit = 50,
): Promise<StoredMessage[]> {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase
    .from("ai_agent_messages")
    .select("*")
    .eq("session_id", sessionId)
    .order("created_at", { ascending: true })
    .limit(limit);

  if (!data) return [];

  return data.map((row: any) => ({
    messageId: row.message_id,
    sessionId: row.session_id,
    role: row.role,
    content: row.content,
    structuredPayload: row.structured_payload ?? undefined,
    createdAt: row.created_at,
  }));
}

export async function getLastMessages(
  sessionId: string,
  count = 10,
): Promise<StoredMessage[]> {
  const messages = await getSessionMessages(sessionId, count);
  return messages.slice(-count);
}
