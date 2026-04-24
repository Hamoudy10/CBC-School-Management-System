import { createSupabaseServerClient } from "../supabase/server";
import { logger } from "../logger";
import type { AITokenUsage } from "./ai.types";

type AILoggerParams = {
  requestLabel?: string;
  model: string;
  schoolId?: string | null;
  prompt: string;
  response?: string;
  success: boolean;
  cached: boolean;
  durationMs: number;
  usage?: AITokenUsage;
  warnings?: string[];
  error?: string;
};

const MAX_LOG_TEXT_LENGTH = 4_000;

function truncate(value: string): string {
  if (value.length <= MAX_LOG_TEXT_LENGTH) {
    return value;
  }

  return `${value.slice(0, MAX_LOG_TEXT_LENGTH)}...[truncated]`;
}

export async function logAIEvent(params: AILoggerParams): Promise<void> {
  const logLevel = params.success ? "info" : "warn";
  logger[logLevel]("AI request completed", {
    source: "ai.logger",
    requestLabel: params.requestLabel ?? "general",
    model: params.model,
    schoolId: params.schoolId ?? null,
    cached: params.cached,
    success: params.success,
    durationMs: params.durationMs,
    usage: params.usage,
    warnings: params.warnings ?? [],
    error: params.error ?? null,
  });

  try {
    const supabase = await createSupabaseServerClient();
    const prompt = truncate(params.prompt);
    const response = truncate(params.response ?? params.error ?? "");
    const cost = params.usage?.totalTokens ?? 0;

    await supabase.from("ai_logs").insert({
      prompt,
      response,
      cost,
      school_id: params.schoolId ?? null,
    });
  } catch (error) {
    logger.debug("AI log persistence skipped", {
      source: "ai.logger",
      error: error instanceof Error ? error.message : "Unknown ai_log persistence error",
    });
  }
}
