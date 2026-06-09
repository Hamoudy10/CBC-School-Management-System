import type { ModuleName, ActionName } from "@/types/roles";
import type { AuthUser } from "@/types/auth";
import type { z } from "zod";

export type RiskLevel = "low" | "medium" | "high" | "critical";

export type AgentIntent = "answer" | "retrieve" | "act" | "clarify" | "refuse";

export type ActionStatus =
  | "planned"
  | "awaiting_confirmation"
  | "approved"
  | "executing"
  | "completed"
  | "failed"
  | "cancelled";

export type SessionMode = "assist" | "act";

export type SessionStatus = "active" | "completed" | "cancelled" | "error";

export type MessageRole = "user" | "assistant" | "system" | "tool";

export interface AgentTool<TInput = unknown, TOutput = unknown> {
  name: string;
  description: string;
  module: ModuleName;
  action: ActionName;
  riskLevel: RiskLevel;
  requiresConfirmation: (input: TInput, user: AuthUser) => boolean;
  inputSchema: z.ZodType<TInput>;
  outputSchema: z.ZodType<TOutput>;
  execute: (input: TInput, context: AgentExecutionContext) => Promise<TOutput>;
}

export interface AgentExecutionContext {
  user: AuthUser;
  schoolId: string;
  sessionId: string;
  actionId?: string;
  requestId: string;
}

export interface AgentPlan {
  intent: AgentIntent;
  userGoal: string;
  toolName: string | null;
  toolInput: Record<string, unknown> | null;
  requiresConfirmation: boolean;
  riskLevel: RiskLevel;
  reasoningSummary: string;
  userFacingMessage: string;
}

export interface AgentChatRequest {
  sessionId?: string;
  message: string;
  pageContext?: {
    route?: string;
    module?: string;
    selectedRecordId?: string;
  };
  mode?: SessionMode;
}

export interface AgentChatResponse {
  sessionId: string;
  message: {
    role: "assistant";
    content: string;
  };
  action?: {
    actionId: string;
    status: ActionStatus;
    preview: Record<string, unknown>;
    riskLevel?: RiskLevel;
    requiresConfirmation?: boolean;
  };
  confidence: number;
  warnings: string[];
}

export interface ConfirmationRequest {
  actionId: string;
  confirmationText?: string;
}

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

export type AIProviderName = "openrouter" | "groq" | "deepseek";

export interface AIProvider {
  name: AIProviderName;
  generate<TJson>(
    request: AIProviderRequest<TJson>,
  ): Promise<AIProviderResponse<TJson | string>>;
}

export interface PageContextData {
  schoolName: string;
  activeAcademicYear?: string;
  activeTerm?: string;
  userRole: string;
  allowedModules: string[];
  allowedActions: Record<string, string[]>;
  currentPage?: string;
  currentModule?: string;
}

export interface SessionSummary {
  sessionId: string;
  title: string;
  mode: SessionMode;
  status: SessionStatus;
  messageCount: number;
  createdAt: string;
  updatedAt: string;
}
