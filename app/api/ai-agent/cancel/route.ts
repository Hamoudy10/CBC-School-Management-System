import { NextRequest } from "next/server";
import { withAuth } from "@/lib/api/withAuth";
import { successResponse, errorResponse } from "@/lib/api/response";
import { cancelAction } from "@/features/ai-agent/services/confirmation.service";
import { cancelRequestSchema } from "@/features/ai-agent/validators/aiAgent.schema";

export const dynamic = "force-dynamic";

export const POST = withAuth(async (request: NextRequest, { user }: any) => {
  try {
    const body = await request.json();
    const validation = cancelRequestSchema.safeParse(body);

    if (!validation.success) {
      return errorResponse("Invalid request", 400);
    }

    const result = await cancelAction(validation.data.actionId, user);

    if (!result.success) {
      return errorResponse(result.error ?? "Cancel failed", 400);
    }

    return successResponse({ success: true });
  } catch (error) {
    return errorResponse("Failed to cancel action", 500);
  }
});
