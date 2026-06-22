import { ToolExecutionError } from "./tool-executor.service";
import { QueryValidationError, QueryPermissionError } from "./safe-query-executor.service";

export const MAX_RETRY_ATTEMPTS = 3;

export interface RetryClassification {
  retryable: boolean;
  category: "validation" | "query" | "permission" | "unknown_tool" | "unknown";
  message: string;
}

export interface RetryContext {
  attempts: number;
  previousPlans: Array<{ plan: string; error: string }>;
}

export function classifyToolError(error: unknown): RetryClassification {
  const msg = error instanceof Error ? error.message : "Unknown error";

  if (error instanceof QueryValidationError) {
    return { retryable: true, category: "validation", message: msg };
  }

  if (error instanceof QueryPermissionError) {
    return { retryable: false, category: "permission", message: msg };
  }

  if (error instanceof ToolExecutionError) {
    if (msg.startsWith("Invalid input:")) {
      return { retryable: true, category: "validation", message: msg };
    }
    if (msg.includes("not filterable") || msg.includes("not readable") || msg.includes("not searchable") || msg.includes("cannot be used for grouping") || msg.includes("cannot be used for ordering") || msg.includes("does not support text search") || msg.includes("Limit cannot exceed") || msg.includes("Unknown entity") || msg.includes("Unknown entity")) {
      return { retryable: true, category: "validation", message: msg };
    }
    if (msg.startsWith("Unknown tool:")) {
      return { retryable: false, category: "unknown_tool", message: msg };
    }
    if (msg.includes("do not have") || msg.includes("permission")) {
      return { retryable: false, category: "permission", message: msg };
    }
    if (msg.includes("Could not find a relationship") || msg.includes("Query failed:")) {
      return { retryable: true, category: "query", message: msg };
    }
    return { retryable: false, category: "unknown", message: msg };
  }

  return { retryable: false, category: "unknown", message: msg };
}

export function buildRetryPrompt(
  originalRequest: string,
  previousPlan: string,
  errorMessage: string,
  attempt: number,
  maxAttempts: number,
): string {
  const entityGuidance = errorMessage.includes("Unknown entity")
    ? `\n\nThe error says the entity name is unknown. Check the Entity Columns section in the system context — only entities listed there are valid. Pick the closest match from that list. If none match, use intent "answer" and tell the user you cannot look that up.`
    : errorMessage.includes("not filterable")
      ? `\n\nThe error says a field is not filterable. Check the filterable columns listed for that entity in Entity Columns below. Only those exact fields can be used in filters.`
      : errorMessage.includes("not readable")
        ? `\n\nThe error says a column is not readable. Check the readable columns listed for that entity in Entity Columns below. Only those exact columns can be selected.`
        : errorMessage.includes("specified more than once")
          ? `\n\nThe query failed because of a database conflict caused by selecting columns from a joined table (e.g. "users.first_name"). Remove any "relation.column" entries from your select — the join already provides those columns automatically.`
          : errorMessage.includes("failed")
            ? `\n\nThe database query failed. Simplify your query: reduce the number of columns selected, remove unnecessary filters, and avoid using joins if possible.`
            : "";

  return `Your previous attempt failed. Please analyze the error and produce a corrected plan.

Original user request: "${originalRequest}"

Your previous plan was:
${previousPlan}

The error was:
${errorMessage}

This is retry attempt ${attempt} of ${maxAttempts}. Fix the issue in your new plan based on the error above.${entityGuidance}`;
}

export function buildRetryExhaustedMessage(
  originalRequest: string,
  errors: Array<{ plan: string; error: string }>,
): string {
  const lastError = errors[errors.length - 1]?.error ?? "Unknown error";
  return `I tried several approaches but could not complete your request. The specific issue was: ${lastError}. Could you try rephrasing your request or ask for something else?`;
}
