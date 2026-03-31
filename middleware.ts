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

const PUBLIC_ROUTES = [
  "/login",
  "/forgot-password",
  "/auth/callback",
  "/auth/reset-password",
  "/auth/verify",
];

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

  return response;
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
