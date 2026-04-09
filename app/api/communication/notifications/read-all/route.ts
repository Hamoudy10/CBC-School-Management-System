export const dynamic = 'force-dynamic';

// app/api/communication/notifications/read-all/route.ts
// DEPRECATED — Redirects to /api/notifications/read-all
// Sunset date: 2026-07-01

import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  const redirect = new URL("/api/notifications/read-all", request.url);
  return NextResponse.redirect(redirect, 301);
}
