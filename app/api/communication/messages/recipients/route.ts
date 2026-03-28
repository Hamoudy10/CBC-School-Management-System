import { withPermission } from "@/lib/api/withAuth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { errorResponse, successResponse } from "@/lib/api/response";

function firstRelation<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return value ?? null;
}

export const GET = withPermission(
  "communication",
  "create",
  async (_request, { user }) => {
    try {
      const supabase = await createSupabaseServerClient();
      const [
        { data: users, error: usersError },
        { data: roles, error: rolesError },
        { data: classes, error: classesError },
      ] = await Promise.all([
        supabase
          .from("users")
          .select(
            `
            user_id,
            first_name,
            last_name,
            email,
            roles ( name )
          `,
          )
          .eq("school_id", user.schoolId!)
          .eq("status", "active")
          .neq("user_id", user.id)
          .order("first_name", { ascending: true })
          .limit(200),
        supabase.from("roles").select("role_id, name").order("name", { ascending: true }),
        supabase
          .from("classes")
          .select("class_id, name, stream")
          .eq("school_id", user.schoolId!)
          .eq("is_active", true)
          .order("name", { ascending: true }),
      ]);

      if (usersError || rolesError || classesError) {
        return errorResponse(
          usersError?.message ||
            rolesError?.message ||
            classesError?.message ||
            "Failed to load recipient options",
          500,
        );
      }

      return successResponse({
        users: (users ?? []).map((row: any) => ({
          id: row.user_id,
          first_name: row.first_name,
          last_name: row.last_name,
          email: row.email,
          role: firstRelation(row.roles)?.name ?? "user",
        })),
        roles: (roles ?? []).map((row: any) => ({
          id: row.role_id,
          name: row.name,
        })),
        classes: (classes ?? []).map((row: any) => ({
          id: row.class_id,
          name: `${row.name ?? ""}${row.stream ? ` ${row.stream}` : ""}`.trim(),
        })),
      });
    } catch (error: any) {
      return errorResponse(error.message, 500);
    }
  },
);
