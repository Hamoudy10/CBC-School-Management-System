import { NextRequest } from "next/server";
import { withPermission } from "@/lib/api/withAuth";
import {
  errorResponse,
  paginatedResponse,
  successResponse,
} from "@/lib/api/response";
import {
  getInbox,
  getSentMessages,
  messageFilterSchema,
  sendMessage,
  sendMessageSchema,
} from "@/features/communication";

function firstRelation<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return value ?? null;
}

export const GET = withPermission(
  { module: "communication", action: "view" },
  async (req: NextRequest, { user }) => {
  try {
    const rawFilters = {
      category: req.nextUrl.searchParams.get("category") ?? undefined,
      priority: req.nextUrl.searchParams.get("priority") ?? undefined,
      read_status: req.nextUrl.searchParams.get("read_status") ?? undefined,
      date_from: req.nextUrl.searchParams.get("date_from") ?? undefined,
      date_to: req.nextUrl.searchParams.get("date_to") ?? undefined,
      search: req.nextUrl.searchParams.get("search") ?? undefined,
      page: req.nextUrl.searchParams.get("page") ?? undefined,
      pageSize: req.nextUrl.searchParams.get("pageSize") ?? undefined,
    };

    const params = messageFilterSchema.safeParse(rawFilters);
    if (!params.success) {
      return errorResponse("Invalid query parameters", 422);
    }

    const filters = params.data;
    const folder = req.nextUrl.searchParams.get("folder") ?? "inbox";
    const page = filters.page ?? 1;
    const pageSize = filters.pageSize ?? 20;
    const result =
      folder === "sent"
        ? await getSentMessages(user.id, user.schoolId!, page, pageSize)
        : await getInbox(user.id, user.schoolId!, filters, page, pageSize);

    if (!result.success) {
      return errorResponse(result.message || "Failed to fetch messages", 500);
    }

    const messages = (result.data ?? [])
      .filter((row: any) => {
        if (!filters.search) {
          return true;
        }

        const content = `${row.subject ?? ""} ${row.body ?? ""}`.toLowerCase();
        return content.includes(filters.search.toLowerCase());
      })
      .map((row: any) => {
        const recipientRelations = (row.recipients ?? [])
          .map((recipient: any) => recipient.recipient)
          .filter(Boolean);
        const firstRecipient = firstRelation(recipientRelations);

        return {
          id: row.id,
          message_id: row.id,
          subject: row.subject,
          body: row.body,
          read_status: row.read_status === true,
          is_read: row.read_status === true,
          created_at: row.created_at,
          sender_id: row.sender_id,
          sender: firstRelation(row.sender),
          recipient: firstRecipient,
          recipient_count: recipientRelations.length,
          recipient_summary:
            recipientRelations.length > 1
              ? `${recipientRelations.length} recipients`
              : firstRecipient
                ? `${firstRecipient.first_name ?? ""} ${firstRecipient.last_name ?? ""}`.trim()
                : null,
        };
      });

    return paginatedResponse(messages, {
      page,
      pageSize,
      total: result.total ?? messages.length,
    });
  } catch (error: any) {
    return errorResponse(error.message, 500);
  }
  },
);

export const POST = withPermission(
  { module: "communication", action: "create" },
  async (req: NextRequest, { user }) => {
  try {
    const body = await req.json();
    const validated = sendMessageSchema.parse(body);

    if (
      validated.recipients.some(
        (recipient) => recipient.recipient_type === "all",
      )
    ) {
      return errorResponse(
        "The all-users recipient type is not supported in this workflow yet.",
        400,
      );
    }

    const result = await sendMessage(validated, user.id, user.schoolId!);
    if (!result.success) {
      return errorResponse(result.message, 400);
    }

    return successResponse(
      {
        id: result.id,
        message: result.message,
      },
      201,
    );
  } catch (error: any) {
    if (error.name === "ZodError") {
      return errorResponse(error.errors, 422);
    }

    return errorResponse(error.message, 500);
  }
  },
);
