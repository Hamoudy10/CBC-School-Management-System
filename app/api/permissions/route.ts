export const dynamic = 'force-dynamic';

// app/api/permissions/route.ts
// ============================================================
// GET /api/permissions — List all permissions (role × module × actions)
// GET /api/permissions?role=teacher — Get permissions for specific role
// GET /api/permissions?module=students — Get permissions for specific module
// ============================================================

import { NextRequest } from "next/server";
import { withAuth } from "@/lib/api/withAuth";
import { successResponse, errorResponse } from "@/lib/api/response";
import {
  PERMISSION_MATRIX,
  ROLE_HIERARCHY,
  ROLES,
  MODULES,
  ACTIONS,
  type RoleName,
  type ModuleName,
} from "@/types/roles";

// ============================================================
// GET Handler — List permissions
// ============================================================
export const GET = withAuth(async (request: NextRequest) => {
  const { searchParams } = new URL(request.url);
  const roleFilter = searchParams.get("role") as RoleName | null;
  const moduleFilter = searchParams.get("module") as ModuleName | null;

  // Validate role filter
  if (roleFilter && !(roleFilter in ROLES)) {
    return errorResponse(
      `Invalid role: ${roleFilter}. Valid roles: ${Object.values(ROLES).join(", ")}`,
      400,
    );
  }

  // Validate module filter
  if (moduleFilter && !(moduleFilter in MODULES)) {
    return errorResponse(
      `Invalid module: ${moduleFilter}. Valid modules: ${Object.values(MODULES).join(", ")}`,
      400,
    );
  }

  // Build response
  let permissions = PERMISSION_MATRIX;

  if (roleFilter) {
    permissions = {
      [roleFilter]: PERMISSION_MATRIX[roleFilter] ?? {},
    } as typeof PERMISSION_MATRIX;
  }

  if (moduleFilter) {
    const filtered: typeof PERMISSION_MATRIX = {} as any;
    for (const [role, modules] of Object.entries(permissions)) {
      if (modules && moduleFilter in modules) {
        filtered[role as RoleName] = {
          [moduleFilter]: modules[moduleFilter],
        };
      }
    }
    permissions = filtered;
  }

  return successResponse({
    roles: Object.values(ROLES),
    modules: Object.values(MODULES),
    actions: Object.values(ACTIONS),
    roleHierarchy: ROLE_HIERARCHY,
    permissions,
  });
});
