import type { ZodSchema } from "zod";

export type AIResponseFormat = "json" | "text";

export type AITokenUsage = {
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
};

export type AIResponse<T> = {
  success: boolean;
  data: T;
  confidence: number;
  reasoning?: string;
  warnings?: string[];
  meta?: {
    model: string;
    attempts: number;
    durationMs: number;
    cached: boolean;
    usage?: AITokenUsage;
  };
};

export type AICacheScope = {
  schoolId?: string | null;
  classId?: string | null;
  subject?: string | null;
  ttlSeconds?: number;
};

export type GenerateGroqCompletionParams<TJson = Record<string, unknown>> = {
  prompt: string;
  system: string;
  temperature?: number;
  responseFormat?: AIResponseFormat;
  model?: string;
  timeoutMs?: number;
  maxPromptChars?: number;
  maxOutputTokens?: number;
  requestLabel?: string;
  responseSchema?: ZodSchema<TJson>;
  cache?: AICacheScope | false;
};

export type AIPromptDefinition = {
  systemRole: string;
  constraints: string[];
  responseSchema: Record<string, unknown>;
  fallbackBehavior: string;
  system: string;
  user: string;
};

export class GroqCompletionError extends Error {
  readonly statusCode?: number;
  readonly attempt?: number;

  constructor(message: string, options?: { statusCode?: number; attempt?: number }) {
    super(message);
    this.name = "GroqCompletionError";
    this.statusCode = options?.statusCode;
    this.attempt = options?.attempt;
  }
}
