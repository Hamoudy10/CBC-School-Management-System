export const dynamic = 'force-dynamic';

// app/api/roles/route.ts
// ============================================================
// GET /api/roles - List all roles
// ============================================================

import { NextRequest } from "next/server";
import { withAuth } from "@/lib/api/withAuth";
import { successResponse } from "@/lib/api/response";
import { listRoles, getUserCountByRole } from "@/features/users";

// ============================================================
// GET Handler - List Roles
// ============================================================
export const GET = withAuth(async (request, { user }) => {
  const { searchParams } = new URL(request.url);
  const includeCount = searchParams.get("includeCount") === "true";

  const roles = await listRoles(user);

  if (includeCount) {
    const counts = await getUserCountByRole(user);
    const rolesWithCounts = roles.map((role) => ({
      ...role,
      userCount: counts.find((c) => c.roleName === role.name)?.count || 0,
    }));
    return successResponse(rolesWithCounts);
  }

  return successResponse(roles);
});
