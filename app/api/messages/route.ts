// app/api/messages/route.ts
// GET inbox, POST send message

import { NextRequest } from "next/server";
import { withPermission } from "@/lib/api/withAuth";
import { validateBody, validateSearchParams } from "@/lib/api/validation";
import { apiSuccess, apiError, apiPaginated } from "@/lib/api/response";
import { rateLimit } from "@/lib/api/rateLimit";
import {
  sendMessageSchema,
  messageFilterSchema,
} from "@/features/communication";
import {
  getInbox,
  sendMessage,
} from "@/features/communication/services/messages.service";

export const GET = withPermission(
  { module: "communication", action: "view" },
  async (req: NextRequest, user) => {
    try {
      const params = validateSearchParams(req, messageFilterSchema);

      if (!params.success) {
        return apiError(params.error, 422);
      }

      const { page, pageSize, ...filters } = params.data;

      const result = await getInbox(
        user.id,
        user.school_id,
        filters,
        page,
        pageSize,
      );

      if (!result.success) {
        return apiError(result.message || "Failed to fetch inbox", 500);
      }

      return apiPaginated(result.data, result.total, page, pageSize);
    } catch (error) {
      return apiError("Internal server error", 500);
    }
  },
);

export const POST = withPermission(
  { module: "communication", action: "create" },
  async (req: NextRequest, user) => {
    try {
      // Rate limit: 50 messages per hour
      const rateLimitResult = rateLimit(`messages:${user.id}`, 50, 3600);
      if (!rateLimitResult.allowed) {
        return apiError(
          `Rate limit exceeded. Try again in ${rateLimitResult.retryAfter} seconds.`,
          429,
        );
      }

      const body = await req.json();
      const validation = validateBody(body, sendMessageSchema);

      if (!validation.success) {
        return apiError(validation.error, 422);
      }

      const result = await sendMessage(
        validation.data,
        user.id,
        user.school_id,
      );

      if (!result.success) {
        return apiError(result.message, 400);
      }

      return apiSuccess({ id: result.id }, result.message, 201);
    } catch (error) {
      return apiError("Internal server error", 500);
    }
  },
);
