// middleware.ts
// ============================================================
// Root Next.js middleware — Optimized for fast edge checks
// Runs before any React rendering
// Handles:
//   1. Fast cookie-based session check (no Supabase call needed)
//   2. Redirect unauthenticated users to login
//   3. Redirect authenticated users away from auth pages
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

  // Fast path: check for Supabase session cookies before hitting Supabase
  // Supabase SSR sets cookies named sb-{project-ref}-auth-token
  const allCookies = request.cookies.getAll();
  const hasSupabaseCookie = allCookies.some(
    (c) => c.name.startsWith("sb-") && c.name.includes("auth-token"),
  );

  const response = NextResponse.next({
    request: { headers: request.headers },
  });

  // If no Supabase cookie and route is protected, redirect immediately
  // This skips the Supabase getUser() call entirely for unauthenticated users
  if (!hasSupabaseCookie && !isPublicRoute) {
    const redirectUrl = new URL("/login", request.url);
    redirectUrl.searchParams.set("redirectTo", pathname);
    return NextResponse.redirect(redirectUrl);
  }

  // If no Supabase cookie and on login page, let it through
  if (!hasSupabaseCookie && isPublicRoute) {
    return response;
  }

  // Has auth cookie — do full Supabase check (handles token refresh)
  const supabase = createSupabaseMiddlewareClient(request, response);

  const {
    data: { user: authUser },
    error: userError,
  } = await supabase.auth.getUser();

  // Redirect authenticated users away from login
  if (isPublicRoute && authUser) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  // Redirect unauthenticated users away from protected routes
  if (!authUser || userError) {
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
