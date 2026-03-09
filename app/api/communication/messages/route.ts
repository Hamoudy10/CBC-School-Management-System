// app/api/communication/messages/route.ts
// GET inbox/sent, POST send message

import { NextRequest } from "next/server";
import { withAuth } from "@/lib/api/withAuth";
import {
  successResponse,
  errorResponse,
  paginatedResponse,
} from "@/lib/api/response";
import { validateSearchParams } from "@/lib/api/validation";
import { MessagesService } from "@/features/communication";
import {
  sendMessageSchema,
  messageFilterSchema,
} from "@/features/communication";

export const GET = withAuth(async (req: NextRequest, user: any) => {
  try {
    const params = validateSearchParams(req, messageFilterSchema);
    if (!params.success) {
      return errorResponse(params.error, 422);
    }
    const filters = params.data;

    const result =
      req.nextUrl.searchParams.get("folder") === "sent"
        ? await MessagesService.getSent(user.school_id, user.id, filters)
        : await MessagesService.getInbox(user.school_id, user.id, filters);

    return paginatedResponse(result.data, {
      page: filters.page,
      pageSize: filters.pageSize,
      total: result.total,
    });
  } catch (error: any) {
    return errorResponse(error.message, 500);
  }
});

export const POST = withAuth(async (req: NextRequest, user: any) => {
  try {
    const body = await req.json();
    const validated = sendMessageSchema.parse(body);
    const result = await MessagesService.sendMessage(
      user.school_id,
      user.id,
      validated,
    );

    if (!result.success) return errorResponse(result.message, 400);
    return successResponse(result, 201);
  } catch (error: any) {
    if (error.name === "ZodError") return errorResponse(error.errors, 422);
    return errorResponse(error.message, 500);
  }
});
