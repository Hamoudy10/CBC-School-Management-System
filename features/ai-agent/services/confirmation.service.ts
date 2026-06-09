import { getAction, updateActionStatus } from "./agent-audit.service";
import { executeConfirmedAction } from "./tool-executor.service";
import type { AuthUser } from "@/types/auth";

export async function confirmAction(
  actionId: string,
  user: AuthUser,
): Promise<{ success: boolean; output?: Record<string, unknown>; error?: string }> {
  try {
    const action = await getAction(actionId);
    if (!action) return { success: false, error: "Action not found" };

    if (action.status !== "awaiting_confirmation") {
      return { success: false, error: `Action is in "${action.status}" status, cannot confirm` };
    }

    if (action.userId !== user.id) {
      return { success: false, error: "This action belongs to another user" };
    }

    if (action.expiresAt && new Date(action.expiresAt) < new Date()) {
      await updateActionStatus(actionId, "cancelled");
      return { success: false, error: "Confirmation window has expired. Please retry the action." };
    }

    const output = await executeConfirmedAction(actionId, user);
    return { success: true, output };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Confirmation failed" };
  }
}

export async function cancelAction(
  actionId: string,
  user: AuthUser,
): Promise<{ success: boolean; error?: string }> {
  try {
    const action = await getAction(actionId);
    if (!action) return { success: false, error: "Action not found" };

    if (action.userId !== user.id) {
      return { success: false, error: "This action belongs to another user" };
    }

    if (!["planned", "awaiting_confirmation"].includes(action.status)) {
      return { success: false, error: `Action is in "${action.status}" status, cannot cancel` };
    }

    await updateActionStatus(actionId, "cancelled");
    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Cancel failed" };
  }
}
