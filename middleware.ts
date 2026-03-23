// middleware.ts
// ============================================================
// Root Next.js middleware
// Runs on protected page requests only.
// Handles:
//   1. Session validation and token refresh
//   2. Redirect unauthenticated users to login
//   3. Role-based route protection
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { createSupabaseMiddlewareClient } from "@/lib/supabase/middleware";
import type { RoleName } from "@/types/roles";
import { hasModuleAccess } from "@/lib/auth/permissions";

const PUBLIC_ROUTES = [
  "/login",
  "/forgot-password",
  "/auth/callback",
  "/auth/reset-password",
  "/auth/verify",
];

const ROUTE_MODULE_MAP: Record<string, string> = {
  "/dashboard": "dashboard",
  "/students": "students",
  "/staff": "teachers",
  "/teachers": "teachers",
  "/classes": "classes",
  "/academics": "academics",
  "/assessments": "assessments",
  "/exams": "exams",
  "/attendance": "attendance",
  "/timetable": "timetable",
  "/finance": "finance",
  "/reports": "reports",
  "/communication": "communication",
  "/discipline": "compliance",
  "/compliance": "compliance",
  "/settings": "settings",
  "/analytics": "analytics",
  "/library": "library",
  "/users": "users",
  "/audit-logs": "audit_logs",
};

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const isPublicRoute = PUBLIC_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`),
  );

  // Most public routes do not need session refresh or auth lookup.
  if (isPublicRoute && pathname !== "/login" && pathname !== "/") {
    return NextResponse.next();
  }

  const response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  const supabase = createSupabaseMiddlewareClient(request, response);
  const usersTable = () => supabase.from("users") as any;

  const {
    data: { user: authUser },
    error: userError,
  } = await supabase.auth.getUser();

  if (isPublicRoute) {
    if (authUser && (pathname === "/login" || pathname === "/")) {
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }
    return response;
  }

  if (!authUser || userError) {
    const redirectUrl = new URL("/login", request.url);
    redirectUrl.searchParams.set("redirectTo", pathname);
    return NextResponse.redirect(redirectUrl);
  }

  const { data: userData, error: profileError } = await usersTable()
    .select(
      `
      user_id,
      school_id,
      status,
      email_verified,
      roles (
        name
      )
    `,
    )
    .eq("user_id", authUser.id)
    .single();

  if (profileError || !userData) {
    await supabase.auth.signOut();
    return NextResponse.redirect(
      new URL("/login?error=profile_not_found", request.url),
    );
  }

  const userRole = (userData.roles as any)?.name as RoleName;
  const userStatus = userData.status;

  if (userStatus !== "active") {
    await supabase.auth.signOut();
    return NextResponse.redirect(
      new URL(`/login?error=account_${userStatus}`, request.url),
    );
  }

  const matchedModule = findModuleForPath(pathname);

  if (matchedModule) {
    const hasAccess = hasModuleAccess(userRole, matchedModule as any);

    if (!hasAccess) {
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }
  }

  return response;
}

function findModuleForPath(pathname: string): string | null {
  const segments = pathname.split("/").filter(Boolean);
  if (segments.length === 0) {
    return null;
  }

  const directPath = `/${segments[0]}`;
  if (ROUTE_MODULE_MAP[directPath]) {
    return ROUTE_MODULE_MAP[directPath];
  }

  return null;
}

export const config = {
  matcher: [
    /*
     * Match application pages except:
     * - all API routes (API handlers already do their own auth/authorization)
     * - Next static/image assets
     * - favicon and common images
     */
    "/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
