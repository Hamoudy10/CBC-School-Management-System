export const dynamic = 'force-dynamic';

// app/api/messages/route.ts
// DEPRECATED: This route is a legacy alias for /api/communication/messages.
// All new development should target /api/communication/messages directly.
// This file returns a deprecation warning header and forwards to the canonical path.

import { NextRequest, NextResponse } from "next/server";
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

function withDeprecationHeaders(response: NextResponse): NextResponse {
  response.headers.set("Deprecation", "true");
  response.headers.set(
    "Link",
    '</api/communication/messages>; rel="successor-version"',
  );
  response.headers.set(
    "Sunset",
    "2026-07-01T00:00:00Z",
  );
  return response;
}

export const GET = withPermission(
  { module: "communication", action: "view" },
  async (req: NextRequest, user) => {
    try {
      const params = validateSearchParams(req, messageFilterSchema);

      if (!params.success) {
        return withDeprecationHeaders(apiError(params.error, 422));
      }

      const { page, pageSize, ...filters } = params.data;

      const result = await getInbox(
        user.id,
        user.schoolId,
        filters,
        page,
        pageSize,
      );

      if (!result.success) {
        return withDeprecationHeaders(apiError(result.message || "Failed to fetch inbox", 500));
      }

      return withDeprecationHeaders(apiPaginated(result.data, result.total, page, pageSize));
    } catch (error) {
      return withDeprecationHeaders(apiError("Internal server error", 500));
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
        return withDeprecationHeaders(apiError(
          `Rate limit exceeded. Try again in ${rateLimitResult.retryAfter} seconds.`,
          429,
        ));
      }

      const body = await req.json();
      const validation = validateBody(body, sendMessageSchema);

      if (!validation.success) {
        return withDeprecationHeaders(apiError(validation.error, 422));
      }

      const result = await sendMessage(
        validation.data,
        user.id,
        user.schoolId,
      );

      if (!result.success) {
        return withDeprecationHeaders(apiError(result.message, 400));
      }

      return withDeprecationHeaders(apiSuccess({ id: result.id }, result.message, 201));
    } catch (error) {
      return withDeprecationHeaders(apiError("Internal server error", 500));
    }
  },
);
