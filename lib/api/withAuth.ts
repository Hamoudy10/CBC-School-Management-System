// lib/api/withAuth.ts
// ============================================================
// API Route Authentication & Authorization Wrapper
// Wraps route handlers with auth checks
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest, authorizeRequest } from "@/lib/auth/api-guard";
import { checkRateLimit } from "./rateLimit";
import {
  forbiddenResponse,
  rateLimitResponse,
  serverErrorResponse,
} from "./response";
import type { AuthUser } from "@/types/auth";
import type { ModuleName, ActionName } from "@/types/roles";

// ============================================================
// Handler Types
// ============================================================
export type AuthenticatedHandler = (
  ...args: any[]
) => Promise<any>;

export type RouteParams = {
  params: Record<string, string>;
};

function buildLegacyUser(user: AuthUser) {
  return {
    ...user,
    user_id: user.id,
    school_id: user.schoolId,
  };
}

async function callHandler(
  handler: AuthenticatedHandler,
  request: NextRequest,
  user: AuthUser,
  params: Record<string, string>,
): Promise<any> {
  const legacyUser = buildLegacyUser(user);
  const handlerContext = {
    ...legacyUser,
    user,
    params,
  };

  // Legacy route signature: (req, user, { params })
  if (handler.length >= 3) {
    return await (handler as any)(request, legacyUser, { params });
  }

  // 2-arg handlers are inconsistent across the codebase:
  // some expect `(req, user)` and others expect `(req, { user, params })`.
  // Pass a hybrid object so both styles can read the fields they expect.
  return await (handler as any)(request, handlerContext);
}

// ============================================================
// withAuth - Require Authentication Only
// ============================================================
export function withAuth(handler: AuthenticatedHandler) {
  return async (
    request: NextRequest,
    { params }: RouteParams = { params: {} },
  ): Promise<NextResponse> => {
    try {
      // Rate limiting
      const authResult = await authenticateRequest();

      if (!authResult.authenticated) {
        return authResult.response;
      }

      const { user } = authResult;

      // Check rate limit
      const rateLimit = checkRateLimit(request, undefined, user.id);
      if (!rateLimit.allowed) {
        return rateLimitResponse();
      }

      return await callHandler(handler, request, user, params);
    } catch (error) {
      console.error("API Error:", error);
      return serverErrorResponse();
    }
  };
}

// ============================================================
// withPermission - Require Specific Permission
// ============================================================
export function withPermission(
  moduleOrConfig:
    | ModuleName
    | { module: ModuleName; action: ActionName | "edit" },
  actionOrHandler: ActionName | "edit" | AuthenticatedHandler,
  maybeHandler?: AuthenticatedHandler,
) {
  const module =
    typeof moduleOrConfig === "object" ? moduleOrConfig.module : moduleOrConfig;
  const rawAction =
    typeof moduleOrConfig === "object"
      ? moduleOrConfig.action
      : (actionOrHandler as ActionName);
  const action =
    rawAction === "edit" ? ("update" as ActionName) : (rawAction as ActionName);
  const handler =
    (typeof actionOrHandler === "function"
      ? actionOrHandler
      : maybeHandler) as AuthenticatedHandler;

  return async (
    request: NextRequest,
    { params }: RouteParams = { params: {} },
  ): Promise<NextResponse> => {
    try {
      const authResult = await authorizeRequest(module, action);

      if (!authResult.authorized) {
        return authResult.response;
      }

      const { user } = authResult;

      // Check rate limit
      const rateLimit = checkRateLimit(request, undefined, user.id);
      if (!rateLimit.allowed) {
        return rateLimitResponse();
      }

      return await callHandler(handler, request, user, params);
    } catch (error) {
      console.error("API Error:", error);
      return serverErrorResponse();
    }
  };
}

// ============================================================
// withRoles - Require Specific Role(s)
// ============================================================
export function withRoles(
  allowedRoles: string[],
  handler: AuthenticatedHandler,
) {
  return async (
    request: NextRequest,
    { params }: RouteParams = { params: {} },
  ): Promise<NextResponse> => {
    try {
      const authResult = await authenticateRequest();

      if (!authResult.authenticated) {
        return authResult.response;
      }

      const { user } = authResult;

      if (!allowedRoles.includes(user.role)) {
        return forbiddenResponse(
          "Your role does not have access to this resource",
        );
      }

      // Check rate limit
      const rateLimit = checkRateLimit(request, undefined, user.id);
      if (!rateLimit.allowed) {
        return rateLimitResponse();
      }

      return await callHandler(handler, request, user, params);
    } catch (error) {
      console.error("API Error:", error);
      return serverErrorResponse();
    }
  };
}
