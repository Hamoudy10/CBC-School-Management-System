export const dynamic = 'force-dynamic';

// app/api/communication/unread-count/route.ts
// DEPRECATED — Redirects to /api/notifications/unread-count
// Sunset date: 2026-07-01

import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const redirect = new URL("/api/notifications/unread-count", request.url);
  return NextResponse.redirect(redirect, 301);
}
