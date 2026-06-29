import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/api/withAuth";
import { successResponse, errorResponse } from "@/lib/api/response";
import { getSession, getSessionMessages, updateSessionStatus } from "@/features/ai-agent/services/memory.service";

export const dynamic = "force-dynamic";

export const GET = withAuth(
  async (request: NextRequest, user: any, { params }: any) => {
    try {
      const { id } = params;
      const session = await getSession(id);

      if (!session) return errorResponse("Session not found", 404);
      if (session.userId !== user.id && session.schoolId !== user.schoolId) {
        return errorResponse("Access denied", 403);
      }

      const messages = await getSessionMessages(id);
      return successResponse({ session, messages });
    } catch (error) {
      return errorResponse("Failed to load session", 500);
    }
  },
);

export const PATCH = withAuth(
  async (request: NextRequest, user: any, { params }: any) => {
    try {
      const { id } = params;
      const session = await getSession(id);

      if (!session) return errorResponse("Session not found", 404);
      if (session.userId !== user.id && user.role !== "super_admin") {
        return errorResponse("Access denied", 403);
      }

      const body = await request.json();
      await updateSessionStatus(id, body.status ?? session.status, body.title);
      return successResponse({ success: true });
    } catch (error) {
      return errorResponse("Failed to update session", 500);
    }
  },
);
