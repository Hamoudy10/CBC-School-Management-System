import type { z } from "zod";

export type AIProviderName = "openrouter" | "groq";

export interface AIProviderRequest<TJson = unknown> {
  system: string;
  prompt: string;
  model?: string;
  responseFormat: "json" | "text";
  temperature?: number;
  maxOutputTokens?: number;
  responseSchema?: z.ZodType<TJson>;
  requestLabel: string;
  cache?: false | {
    schoolId?: string;
    classId?: string;
    subject?: string;
    ttlSeconds?: number;
  };
}

export interface AIProviderResponse<T = unknown> {
  success: boolean;
  data: T;
  confidence: number;
  warnings?: string[];
  meta?: {
    model: string;
    attempts: number;
    durationMs: number;
    cached: boolean;
    usage?: {
      promptTokens?: number;
      completionTokens?: number;
      totalTokens?: number;
    };
  };
}

export interface AIProvider {
  name: AIProviderName;
  generate<TJson>(
    request: AIProviderRequest<TJson>,
  ): Promise<AIProviderResponse<TJson | string>>;
}

export class AIProviderError extends Error {
  readonly statusCode?: number;
  readonly attempt?: number;
  readonly provider: AIProviderName;

  constructor(
    message: string,
    options?: { statusCode?: number; attempt?: number; provider?: AIProviderName },
  ) {
    super(message);
    this.name = "AIProviderError";
    this.statusCode = options?.statusCode;
    this.attempt = options?.attempt;
    this.provider = options?.provider ?? "openrouter";
  }
}
