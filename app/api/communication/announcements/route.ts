export const dynamic = 'force-dynamic';

import { NextRequest } from "next/server";
import { withAuth, withPermission } from "@/lib/api/withAuth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  errorResponse,
  paginatedResponse,
  successResponse,
} from "@/lib/api/response";
import { createAnnouncementSchema } from "@/features/communication";

function firstRelation<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return value ?? null;
}

export const GET = withAuth(async (req: NextRequest, user: any) => {
  try {
    const url = new URL(req.url);
    const page = Number(url.searchParams.get("page") || "1");
    const pageSize = Number(url.searchParams.get("pageSize") || url.searchParams.get("page_size") || "20");
    const includeAll = url.searchParams.get("all") === "true";
    const today = new Date().toISOString();
    const supabase = await createSupabaseServerClient();
    const offset = (page - 1) * pageSize;

    let query = supabase
      .from("announcements")
      .select(
        `
        id,
        title,
        body,
        priority,
        target_roles,
        target_class_ids,
        publish_at,
        expires_at,
        is_pinned,
        created_at,
        created_by,
        author:users!announcements_created_by_fkey(first_name, last_name)
      `,
        { count: "exact" },
      )
      .eq("school_id", user.school_id);

    if (!includeAll) {
      query = query.lte("publish_at", today).or(`expires_at.is.null,expires_at.gte.${today}`);
    }

    const { data, error, count } = await query
      .order("is_pinned", { ascending: false })
      .order("publish_at", { ascending: false })
      .range(offset, offset + pageSize - 1);

    if (error) {
      return errorResponse(error.message, 500);
    }

    const announcements = (data ?? [])
      .filter((row: any) => {
        if (includeAll) {
          return true;
        }

        const privilegedRoles = new Set([
          "super_admin",
          "school_admin",
          "principal",
          "deputy_principal",
        ]);

        if (privilegedRoles.has(user.role)) {
          return true;
        }

        const targetRoles = row.target_roles ?? [];
        return targetRoles.length === 0 || targetRoles.includes(user.role);
      })
      .map((row: any) => ({
      id: row.id,
      announcement_id: row.id,
      title: row.title,
      body: row.body,
      priority: row.priority,
      target_roles: row.target_roles ?? [],
      target_class_ids: row.target_class_ids ?? [],
      publish_at: row.publish_at,
      expires_at: row.expires_at,
      created_at: row.created_at,
      author: firstRelation(row.author),
    }));

    return paginatedResponse(announcements, {
      page,
      pageSize,
      total: includeAll ? count ?? 0 : announcements.length,
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
      const validated = createAnnouncementSchema.parse(body);
      const supabase = await createSupabaseServerClient();

      const { data, error } = await supabase
        .from("announcements")
        .insert({
          school_id: user.school_id,
          title: validated.title,
          body: validated.body,
          priority: validated.priority,
          target_roles: validated.target_roles ?? [],
          target_class_ids: validated.target_classes ?? [],
          publish_at: `${validated.publish_date}T00:00:00`,
          expires_at: validated.expiry_date
            ? `${validated.expiry_date}T23:59:59`
            : null,
          created_by: user.id,
          is_pinned: validated.priority === "urgent",
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
