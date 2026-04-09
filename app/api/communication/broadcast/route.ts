export const dynamic = 'force-dynamic';

// app/api/communication/broadcast/route.ts
// GET list broadcast messages, POST broadcast message to roles/classes

import { NextRequest } from "next/server";
import { withPermission } from "@/lib/api/withAuth";
import { successResponse, errorResponse, paginatedResponse } from "@/lib/api/response";
import { MessagesService, broadcastSchema } from "@/features/communication";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const GET = withPermission(
  { module: "communication", action: "view" },
  async (req: NextRequest, { user }) => {
    try {
      const supabase = await createSupabaseServerClient();

      const page = parseInt(req.nextUrl.searchParams.get("page") ?? "1", 10) || 1;
      const pageSize = parseInt(req.nextUrl.searchParams.get("pageSize") ?? "20", 10) || 20;
      const targetRoles = req.nextUrl.searchParams.getAll("target_roles");
      const dateFrom = req.nextUrl.searchParams.get("date_from") ?? undefined;
      const dateTo = req.nextUrl.searchParams.get("date_to") ?? undefined;

      let query = supabase
        .from("broadcast_messages")
        .select("*", { count: "exact" })
        .eq("school_id", user.school_id)
        .order("created_at", { ascending: false });

      if (targetRoles.length > 0) {
        query = query.overlaps("target_roles", targetRoles);
      }

      if (dateFrom) {
        query = query.gte("created_at", dateFrom);
      }

      if (dateTo) {
        query = query.lte("created_at", dateTo);
      }

      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;
      const { data, error, count } = await query.range(from, to);

      if (error) {
        return errorResponse(error.message, 400);
      }

      return paginatedResponse(data ?? [], {
        page,
        pageSize,
        total: count ?? 0,
      });
    } catch (error: any) {
      return errorResponse(error.message, 500);
    }
  },
);

export const POST = withPermission(
  "communication",
  "create",
  async (req: NextRequest, user: any) => {
    try {
      const body = await req.json();
      const validated = broadcastSchema.parse(body);
      const result = await MessagesService.broadcastMessage(
        user.school_id,
        user.id,
        validated,
      );

      if (!result.success) {return errorResponse(result.message, 400);}
      return successResponse(result, 201);
    } catch (error: any) {
      if (error.name === "ZodError") {return errorResponse(error.errors, 422);}
      return errorResponse(error.message, 500);
    }
  },
);
