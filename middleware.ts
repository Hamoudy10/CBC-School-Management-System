// middleware.ts
// ============================================================
// Root Next.js middleware — Simplified for reliability
// Runs before any React rendering
// Handles:
//   1. Redirect unauthenticated users to login
//   2. Redirect authenticated users away from auth pages
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

// Static/asset routes that skip all auth checks
const STATIC_PREFIXES = [
  "/_next/static",
  "/_next/image",
  "/favicon.ico",
];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Skip static assets immediately
  if (STATIC_PREFIXES.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  const isPublicRoute = PUBLIC_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`),
  );

  // Public routes (except login) don't need any auth check
  if (isPublicRoute && pathname !== "/login") {
    return NextResponse.next();
  }

  const response = NextResponse.next({
    request: { headers: request.headers },
  });

  // Always use Supabase to check auth — handles token refresh properly
  const supabase = createSupabaseMiddlewareClient(request, response);

  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();

  // Redirect authenticated users away from login
  if (isPublicRoute && authUser) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  // Redirect unauthenticated users away from protected routes
  if (!authUser && !isPublicRoute) {
    const redirectUrl = new URL("/login", request.url);
    redirectUrl.searchParams.set("redirectTo", pathname);
    return NextResponse.redirect(redirectUrl);
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
