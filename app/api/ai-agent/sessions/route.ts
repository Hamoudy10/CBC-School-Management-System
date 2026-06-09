import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/api/withAuth";
import { successResponse, errorResponse } from "@/lib/api/response";
import { createSession, listUserSessions } from "@/features/ai-agent/services/memory.service";

export const dynamic = "force-dynamic";

export const GET = withAuth(async (request: NextRequest, { user }: any) => {
  try {
    const sessions = await listUserSessions(user.id, user.schoolId);
    return successResponse({ sessions });
  } catch (error) {
    return errorResponse("Failed to load sessions", 500);
  }
});

export const POST = withAuth(async (request: NextRequest, { user }: any) => {
  try {
    const body = await request.json();
    const sessionId = await createSession(
      user.id,
      user.schoolId,
      body.mode ?? "assist",
      body.title,
    );
    return successResponse({ sessionId });
  } catch (error) {
    return errorResponse("Failed to create session", 500);
  }
});
