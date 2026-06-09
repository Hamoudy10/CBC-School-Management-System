import type { RiskLevel, AgentTool } from "@/features/ai-agent/types";
import type { AuthUser } from "@/types/auth";

export function assessRiskLevel(tool: AgentTool, _input: unknown, _user: AuthUser): RiskLevel {
  return tool.riskLevel;
}

export function requiresConfirmation(
  tool: AgentTool,
  input: unknown,
  user: AuthUser,
): boolean {
  if (tool.riskLevel === "low") return false;
  if (tool.riskLevel === "medium") {
    return false;
  }
  if (tool.requiresConfirmation(input, user)) return true;
  return tool.riskLevel === "high" || tool.riskLevel === "critical";
}

export function getConfirmationTimeoutMs(riskLevel: RiskLevel): number {
  switch (riskLevel) {
    case "high":
      return 5 * 60 * 1000;
    case "critical":
      return 10 * 60 * 1000;
    default:
      return 10 * 60 * 1000;
  }
}

export function isActionExpired(createdAt: Date, riskLevel: RiskLevel): boolean {
  const timeout = getConfirmationTimeoutMs(riskLevel);
  return Date.now() - createdAt.getTime() > timeout;
}
