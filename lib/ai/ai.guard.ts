export const DEFAULT_AI_TIMEOUT_MS = 30_000;
export const DEFAULT_AI_MAX_PROMPT_CHARS = 30_000;
export const DEFAULT_AI_MAX_OUTPUT_TOKENS = 2_048;

const PROMPT_INJECTION_PATTERNS: RegExp[] = [
  /ignore\s+(all\s+)?(previous|prior|above)\s+(instructions|directives|rules|commands)/i,
  /forget\s+(all\s+)?(previous|prior|above)\s+(instructions|directives|rules|commands)/i,
  /disregard\s+(all\s+)?(previous|prior|above)\s+(instructions|directives|rules|commands)/i,
  /you\s+are\s+(now|not\s+(bound\s+by|required\s+to\s+follow))/i,
  /new\s+(instruction|directive|rule|command|system\s+prompt):/i,
  /system\s+(prompt|message|instruction):/i,
  /you\s+are\s+now\s+(a\s+)?(free|unrestricted|ungoverned|unfiltered)/i,
];

const HARMFUL_CONTENT_PATTERNS: RegExp[] = [
  /(hate|discriminat|racist|sexist|offensive)\s+(speech|content|language)/i,
  /(violence|violent|harm|abuse|assault|terror)/i,
  /(explicit|porn|nudity|sexual)/i,
  /(illegal|unlawful|criminal)\s+(activity|content)/i,
];

export function detectPromptInjection(userMessage: string): {
  injected: boolean;
  matchedPattern?: string;
} {
  for (const pattern of PROMPT_INJECTION_PATTERNS) {
    const match = userMessage.match(pattern);
    if (match) {
      return { injected: true, matchedPattern: match[0] };
    }
  }
  return { injected: false };
}

export function moderateOutput(content: string): {
  flagged: boolean;
  reason?: string;
} {
  for (const pattern of HARMFUL_CONTENT_PATTERNS) {
    const match = content.match(pattern);
    if (match) {
      return { flagged: true, reason: `Flagged: ${match[0]}` };
    }
  }
  return { flagged: false };
}

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
