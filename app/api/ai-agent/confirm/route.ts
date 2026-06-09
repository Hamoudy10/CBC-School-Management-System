import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/api/withAuth";
import { successResponse, errorResponse } from "@/lib/api/response";
import { confirmAction } from "@/features/ai-agent/services/confirmation.service";
import { confirmationRequestSchema } from "@/features/ai-agent/validators/aiAgent.schema";

export const dynamic = "force-dynamic";

export const POST = withAuth(async (request: NextRequest, { user }: any) => {
  try {
    const body = await request.json();
    const validation = confirmationRequestSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { success: false, error: "Invalid request", details: validation.error.issues },
        { status: 400 },
      );
    }

    const result = await confirmAction(validation.data.actionId, user);

    if (!result.success) {
      return errorResponse(result.error ?? "Confirmation failed", 400);
    }

    return successResponse({ output: result.output });
  } catch (error) {
    return errorResponse("Failed to confirm action", 500);
  }
});
