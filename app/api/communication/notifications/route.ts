import { NextRequest } from "next/server";
import { withAuth, withPermission } from "@/lib/api/withAuth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  errorResponse,
  paginatedResponse,
  successResponse,
} from "@/lib/api/response";
import { validateSearchParams } from "@/lib/api/validation";
import {
  bulkNotificationSchema,
  createNotificationSchema,
  notificationFilterSchema,
} from "@/features/communication";

export const GET = withAuth(async (req: NextRequest, user: any) => {
  try {
    const params = validateSearchParams(req, notificationFilterSchema);
    if (!params.success) {
      return errorResponse(params.error, 422);
    }

    const filters = params.data;
    const page = filters.page ?? 1;
    const pageSize = filters.pageSize ?? 20;
    const offset = (page - 1) * pageSize;
    const supabase = await createSupabaseServerClient();

    let query = supabase
      .from("notifications")
      .select(
        `
        id,
        title,
        body,
        type,
        read_status,
        read_at,
        action_url,
        created_at
      `,
        { count: "exact" },
      )
      .eq("school_id", user.school_id)
      .eq("user_id", user.id);

    if (filters.type) {
      query = query.eq("type", filters.type);
    }

    if (filters.read_status !== undefined) {
      query = query.eq("read_status", filters.read_status ? "read" : "unread");
    }

    if (filters.date_from) {
      query = query.gte("created_at", `${filters.date_from}T00:00:00`);
    }

    if (filters.date_to) {
      query = query.lte("created_at", `${filters.date_to}T23:59:59`);
    }

    const { data, error, count } = await query
      .order("created_at", { ascending: false })
      .range(offset, offset + pageSize - 1);

    if (error) {
      return errorResponse(error.message, 500);
    }

    const notifications = (data ?? []).map((row: any) => ({
      id: row.id,
      notification_id: row.id,
      title: row.title,
      body: row.body,
      type: row.type,
      read_status: row.read_status === "read",
      is_read: row.read_status === "read",
      read_at: row.read_at,
      action_url: row.action_url,
      created_at: row.created_at,
    }));

    return paginatedResponse(notifications, {
      page,
      pageSize,
      total: count ?? 0,
    });
  } catch (error: any) {
    return errorResponse(error.message, 500);
  }
});

export const POST = withPermission(
  "communication",
  "create",
  async (req: NextRequest, user: any) => {
    try {
      const body = await req.json();
      const supabase = await createSupabaseServerClient();

      if (body.user_ids && Array.isArray(body.user_ids)) {
        const validated = bulkNotificationSchema.parse(body);
        const rows = validated.user_ids.map((userId) => ({
          school_id: user.school_id,
          user_id: userId,
          title: validated.title,
          body: validated.body,
          type: validated.type,
          action_url: validated.action_url ?? null,
          read_status: "unread",
        }));

        const { error } = await supabase.from("notifications").insert(rows);
        if (error) {
          return errorResponse(error.message, 400);
        }

        return successResponse({ count: rows.length }, 201);
      }

      const validated = createNotificationSchema.parse(body);
      const { data, error } = await supabase
        .from("notifications")
        .insert({
          school_id: user.school_id,
          user_id: validated.user_id,
          title: validated.title,
          body: validated.body,
          type: validated.type,
          action_url: validated.action_url ?? null,
          read_status: "unread",
        })
        .select("id")
        .single();

      if (error) {
        return errorResponse(error.message, 400);
      }

      return successResponse({ id: data.id }, 201);
    } catch (error: any) {
      if (error.name === "ZodError") {
        return errorResponse(error.errors, 422);
      }

      return errorResponse(error.message, 500);
    }
  },
);
