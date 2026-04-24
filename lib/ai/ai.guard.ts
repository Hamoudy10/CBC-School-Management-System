export const DEFAULT_AI_TIMEOUT_MS = 30_000;
export const DEFAULT_AI_MAX_PROMPT_CHARS = 30_000;
export const DEFAULT_AI_MAX_OUTPUT_TOKENS = 2_048;

export function clampTemperature(value?: number): number {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return 0.2;
  }
  return Math.min(1, Math.max(0, value));
}

export function enforcePromptLimit(
  prompt: string,
  maxPromptChars: number = Number(process.env.AI_MAX_PROMPT_CHARS ?? DEFAULT_AI_MAX_PROMPT_CHARS),
) {
  if (prompt.length <= maxPromptChars) {
    return {
      prompt,
      truncated: false,
      warning: null as string | null,
    };
  }

  return {
    prompt: prompt.slice(0, maxPromptChars),
    truncated: true,
    warning: `Prompt exceeded ${maxPromptChars} chars and was truncated.`,
  };
}

export function enforceOutputTokenLimit(
  maxTokens?: number,
  ceiling: number = Number(process.env.AI_MAX_OUTPUT_TOKENS ?? DEFAULT_AI_MAX_OUTPUT_TOKENS),
): number {
  if (typeof maxTokens !== "number" || Number.isNaN(maxTokens) || maxTokens <= 0) {
    return ceiling;
  }

  return Math.min(maxTokens, ceiling);
}

export function safeJsonParse<T>(input: string):
  | { success: true; data: T }
  | { success: false; error: string } {
  try {
    return {
      success: true,
      data: JSON.parse(input) as T,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Invalid JSON response",
    };
  }
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
