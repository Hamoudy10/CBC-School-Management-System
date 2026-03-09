// middleware.ts
// ============================================================
// Root Next.js middleware
// Runs on EVERY request to protected routes
// Handles:
//   1. Session validation & token refresh
//   2. Redirect unauthenticated users to login
//   3. Role-based route protection
//   4. School-scoped access enforcement
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { createSupabaseMiddlewareClient } from "@/lib/supabase/middleware";
import type { RoleName } from "@/types/roles";
import { hasModuleAccess } from "@/lib/auth/permissions";

// ============================================================
// PUBLIC ROUTES — no auth required
// ============================================================
const PUBLIC_ROUTES = [
  "/login",
  "/forgot-password",
  "/auth/callback",
  "/auth/reset-password",
  "/auth/verify",
];

// ============================================================
// ROUTE → MODULE MAPPING
// Maps URL paths to module names for RBAC checks
// ============================================================
const ROUTE_MODULE_MAP: Record<string, string> = {
  "/dashboard": "dashboard",
  "/students": "students",
  "/teachers": "teachers",
  "/classes": "classes",
  "/academics": "academics",
  "/assessments": "assessments",
  "/attendance": "attendance",
  "/finance": "finance",
  "/reports": "reports",
  "/communication": "communication",
  "/compliance": "compliance",
  "/settings": "settings",
  "/analytics": "analytics",
  "/library": "library",
  "/users": "users",
  "/audit-logs": "audit_logs",
};

// ============================================================
// MIDDLEWARE FUNCTION
// ============================================================
export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // ─── Create response to pass through ───
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  // ─── Create Supabase client for middleware ───
  const supabase = createSupabaseMiddlewareClient(request, response);
  const usersTable = () => supabase.from("users") as any;

  // ─── Refresh session (critical for token rotation) ───
  const {
    data: { user: authUser },
    error: userError,
  } = await supabase.auth.getUser();

  // ============================================================
  // 1. PUBLIC ROUTE CHECK
  // ============================================================
  const isPublicRoute = PUBLIC_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`),
  );

  if (isPublicRoute) {
    // If already logged in and trying to access login page, redirect to dashboard
    if (authUser && (pathname === "/login" || pathname === "/")) {
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }
    return response;
  }

  // ============================================================
  // 2. AUTHENTICATION CHECK
  // ============================================================
  if (!authUser || userError) {
    // Store the intended URL for post-login redirect
    const redirectUrl = new URL("/login", request.url);
    redirectUrl.searchParams.set("redirectTo", pathname);
    return NextResponse.redirect(redirectUrl);
  }

  // ============================================================
  // 3. FETCH USER ROLE & STATUS
  // ============================================================
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

  // User record not found — invalid state
  if (profileError || !userData) {
    await supabase.auth.signOut();
    return NextResponse.redirect(
      new URL("/login?error=profile_not_found", request.url),
    );
  }

  const userRole = (userData.roles as any)?.name as RoleName;
  const userStatus = userData.status;
  const userSchoolId = userData.school_id;

  // ============================================================
  // 4. ACCOUNT STATUS CHECK
  // ============================================================
  if (userStatus !== "active") {
    await supabase.auth.signOut();
    return NextResponse.redirect(
      new URL(`/login?error=account_${userStatus}`, request.url),
    );
  }

  // ============================================================
  // 5. ROLE-BASED ROUTE ACCESS
  // ============================================================
  const matchedModule = findModuleForPath(pathname);

  if (matchedModule) {
    const hasAccess = hasModuleAccess(userRole, matchedModule as any);

    if (!hasAccess) {
      // Redirect to dashboard with access denied message
      return NextResponse.redirect(
        new URL("/dashboard?error=access_denied", request.url),
      );
    }
  }

  // ============================================================
  // 6. SET HEADERS FOR DOWNSTREAM USE
  // ============================================================
  // These headers allow server components and API routes to
  // quickly access user context without re-querying
  response.headers.set("x-user-id", userData.user_id);
  response.headers.set("x-user-role", userRole);
  if (userSchoolId) {
    response.headers.set("x-school-id", userSchoolId);
  }

  return response;
}

// ============================================================
// HELPER: Find module name for a given path
// ============================================================
function findModuleForPath(pathname: string): string | null {
  // Remove leading slash and get the first segment
  const segments = pathname.split("/").filter(Boolean);
  if (segments.length === 0) return null;

  // Check direct match first
  const directPath = `/${segments[0]}`;
  if (ROUTE_MODULE_MAP[directPath]) {
    return ROUTE_MODULE_MAP[directPath];
  }

  return null;
}

// ============================================================
// MATCHER: Define which routes this middleware applies to
// Excludes static assets, images, favicon, etc.
// ============================================================
export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder files
     * - api/webhooks (external webhooks)
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$|api/webhooks).*)",
  ],
};
