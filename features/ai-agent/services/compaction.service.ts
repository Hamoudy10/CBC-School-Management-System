import type { StoredMessage } from "./memory.service";
import { getProvider } from "@/lib/ai/providers";

export const COMPACTION_THRESHOLD = 8;
export const COMPACTION_TRIGGER_AFTER = 6;

export interface CompactionResult {
  summary: string;
  userMessageCount: number;
}

export function shouldCompact(messages: StoredMessage[]): boolean {
  const userMessages = messages.filter((m) => m.role === "user");
  return userMessages.length >= COMPACTION_THRESHOLD;
}

export function selectMessagesForCompaction(messages: StoredMessage[]): StoredMessage[] {
  const nonSystemMessages = messages.filter((m) => m.role !== "system");
  return nonSystemMessages;
}

export async function compactConversation(
  messages: StoredMessage[],
  existingSummary?: string,
): Promise<CompactionResult> {
  const toCompact = selectMessagesForCompaction(messages);
  const userMessageCount = toCompact.filter((m) => m.role === "user").length;

  const conversationText = toCompact
    .map((m) => `${m.role.toUpperCase()}: ${m.content}`)
    .join("\n");

  const provider = getProvider();

  const systemPrompt = existingSummary
    ? `You are a conversation summarizer. Below is an existing summary and new conversation turns. Produce a concise updated summary that captures all key information the assistant needs to continue the conversation. Include user requests, data retrieved, answers given, and any pending actions. Keep it under 300 words. Do not use markdown.`
    : `You are a conversation summarizer. Summarize the following conversation between a user and a school management AI assistant. Include user requests, data retrieved, answers given, and any pending actions. Keep it under 300 words. Do not use markdown.`;

  const prompt = existingSummary
    ? `Existing summary:\n${existingSummary}\n\nNew conversation turns:\n${conversationText}`
    : conversationText;

  const result = await provider.generate({
    system: systemPrompt,
    prompt,
    responseFormat: "text",
    requestLabel: "ai-agent.compaction",
    temperature: 0.3,
    maxOutputTokens: 500,
  });

  const summary = result.success
    ? (result.data as string)
    : existingSummary ?? "Conversation summary unavailable.";

  return { summary, userMessageCount };
}
