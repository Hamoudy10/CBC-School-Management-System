import { NextRequest } from "next/server";
import { withAuth } from "@/lib/api/withAuth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  errorResponse,
  paginatedResponse,
  successResponse,
} from "@/lib/api/response";
import { validateSearchParams } from "@/lib/api/validation";
import { messageFilterSchema, sendMessageSchema } from "@/features/communication";

function firstRelation<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return value ?? null;
}

export const GET = withAuth(async (req: NextRequest, user: any) => {
  try {
    const params = validateSearchParams(req, messageFilterSchema);
    if (!params.success) {
      return errorResponse(params.error, 422);
    }

    const filters = params.data;
    const folder = req.nextUrl.searchParams.get("folder") ?? "inbox";
    const supabase = await createSupabaseServerClient();
    const page = filters.page ?? 1;
    const pageSize = filters.pageSize ?? 20;
    const offset = (page - 1) * pageSize;

    let query = supabase
      .from("messages")
      .select(
        `
        id,
        sender_id,
        receiver_id,
        subject,
        body,
        read_status,
        read_at,
        is_archived,
        sent_at,
        created_at,
        sender:users!messages_sender_id_fkey(first_name, last_name),
        receiver:users!messages_receiver_id_fkey(first_name, last_name)
      `,
        { count: "exact" },
      )
      .eq("school_id", user.school_id)
      .eq("is_archived", false);

    query =
      folder === "sent"
        ? query.eq("sender_id", user.id)
        : query.eq("receiver_id", user.id);

    if (filters.search) {
      query = query.or(
        `subject.ilike.%${filters.search}%,body.ilike.%${filters.search}%`,
      );
    }

    if (filters.date_from) {
      query = query.gte("created_at", `${filters.date_from}T00:00:00`);
    }

    if (filters.date_to) {
      query = query.lte("created_at", `${filters.date_to}T23:59:59`);
    }

    if (filters.read_status !== undefined && folder !== "sent") {
      query = query.eq("read_status", filters.read_status ? "read" : "unread");
    }

    const { data, error, count } = await query
      .order("sent_at", { ascending: false })
      .range(offset, offset + pageSize - 1);

    if (error) {
      return errorResponse(error.message, 500);
    }

    const messages = (data ?? []).map((row: any) => ({
      id: row.id,
      message_id: row.id,
      subject: row.subject,
      body: row.body,
      read_status: row.read_status === "read",
      is_read: row.read_status === "read",
      created_at: row.sent_at ?? row.created_at,
      sender: firstRelation(row.sender),
      recipient: firstRelation(row.receiver),
    }));

    return paginatedResponse(messages, {
      page,
      pageSize,
      total: count ?? 0,
    });
  } catch (error: any) {
    return errorResponse(error.message, 500);
  }
});

export const POST = withAuth(async (req: NextRequest, user: any) => {
  try {
    const body = await req.json();
    const validated = sendMessageSchema.parse(body);
    const supabase = await createSupabaseServerClient();

    const directRecipients = validated.recipients.filter(
      (recipient) => recipient.recipient_type === "user",
    );

    if (directRecipients.length === 0) {
      return errorResponse(
        "Only direct user-to-user messages are supported in this flow right now.",
        400,
      );
    }

    const rows = directRecipients.map((recipient) => ({
      school_id: user.school_id,
      sender_id: user.id,
      receiver_id: recipient.recipient_id,
      subject: validated.subject,
      body: validated.body,
      read_status: "unread",
    }));

    const { error } = await supabase.from("messages").insert(rows);

    if (error) {
      return errorResponse(error.message, 400);
    }

    return successResponse(
      {
        sent: rows.length,
      },
      201,
    );
  } catch (error: any) {
    if (error.name === "ZodError") {
      return errorResponse(error.errors, 422);
    }

    return errorResponse(error.message, 500);
  }
});
