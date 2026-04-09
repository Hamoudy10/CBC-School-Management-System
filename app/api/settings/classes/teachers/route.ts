export const dynamic = 'force-dynamic';

import { NextRequest } from "next/server";
import { withPermission } from "@/lib/api/withAuth";
import { apiError, apiSuccess } from "@/lib/api/response";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const teachingRoles = new Set([
  "teacher",
  "class_teacher",
  "subject_teacher",
  "principal",
  "deputy_principal",
]);

export const GET = withPermission(
  { module: "settings", action: "view" },
  async (_req: NextRequest, { user }) => {
    try {
      const supabase = await createSupabaseServerClient();
      const { data, error } = await supabase
        .from("staff")
        .select(
          `
          staff_id,
          user_id,
          position,
          status,
          users!inner(
            user_id,
            first_name,
            last_name,
            status,
            roles(name)
          )
        `,
        )
        .eq("school_id", user.schoolId!)
        .eq("status", "active")
        .order("position", { ascending: true });

      if (error) {
        return apiError(error.message, 500);
      }

      const teachers = (data ?? [])
        .map((row: any) => {
          const roleRelation = Array.isArray(row.users?.roles)
            ? row.users.roles[0]
            : row.users?.roles;
          const roleName =
            typeof roleRelation?.name === "string"
              ? roleRelation.name.toLowerCase()
              : "";
          const position =
            typeof row.position === "string" ? row.position.toLowerCase() : "";

          return {
            userId: row.user_id,
            firstName: row.users?.first_name ?? "",
            lastName: row.users?.last_name ?? "",
            position,
            roleName,
          };
        })
        .filter(
          (row) =>
            !!row.userId &&
            (teachingRoles.has(row.position) || teachingRoles.has(row.roleName)),
        )
        .sort((left, right) =>
          `${left.firstName} ${left.lastName}`
            .trim()
            .localeCompare(`${right.firstName} ${right.lastName}`.trim()),
        );

      return apiSuccess(teachers);
    } catch (error) {
      return apiError(
        error instanceof Error ? error.message : "Failed to load teachers",
        500,
      );
    }
  },
);
