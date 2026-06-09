import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/api/withAuth";
import { successResponse, errorResponse } from "@/lib/api/response";
import { processAgentMessage } from "@/features/ai-agent/services/agent.service";
import { createSession, listUserSessions, getSessionMessages } from "@/features/ai-agent/services/memory.service";
import { chatRequestSchema, createSessionSchema } from "@/features/ai-agent/validators/aiAgent.schema";

export const dynamic = "force-dynamic";

export const POST = withAuth(async (request: NextRequest, { user }: any) => {
  try {
    const body = await request.json();
    const validation = chatRequestSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { success: false, error: "Invalid request", details: validation.error.issues },
        { status: 400 },
      );
    }

    const result = await processAgentMessage(validation.data, user);
    return successResponse(result);
  } catch (error) {
    console.error("AI Agent chat error:", error);
    return errorResponse(
      error instanceof Error ? error.message : "Failed to process message",
      500,
    );
  }
});

export const GET = withAuth(async (request: NextRequest, { user }: any) => {
  try {
    const url = new URL(request.url);
    const sessionId = url.searchParams.get("sessionId");

    if (sessionId) {
      const messages = await getSessionMessages(sessionId);
      return successResponse({ sessionId, messages });
    }

    const sessions = await listUserSessions(user.id, user.schoolId);
    return successResponse({ sessions });
  } catch (error) {
    console.error("AI Agent sessions error:", error);
    return errorResponse("Failed to load sessions", 500);
  }
});
