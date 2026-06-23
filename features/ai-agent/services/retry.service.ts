import { ToolExecutionError } from "./tool-executor.service";

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
  const entityGuidance = errorMessage.includes("Invalid input")
    ? `\n\nThe tool rejected your input — a required field is missing or invalid. Check the tool's input schema and provide all required fields. For execute_sql, you MUST include the "sql" field with your PostgreSQL SELECT query.`
    : errorMessage.includes("rejected")
      ? `\n\nThe SQL query was rejected by the safety analyzer. Make sure you use only SELECT statements with a LIMIT clause. Write plain PostgreSQL SQL.`
      : errorMessage.includes("syntax error") || errorMessage.includes("does not exist") || errorMessage.includes("column") || errorMessage.includes("relation")
        ? `\n\nThe database rejected the SQL. Use get_db_schema to verify table and column names. Check your JOIN conditions.`
        : errorMessage.includes("failed")
          ? `\n\nThe database query failed. Check your SQL syntax and verify column/table names with get_db_schema.`
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
