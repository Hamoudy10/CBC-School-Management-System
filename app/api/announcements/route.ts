export const dynamic = 'force-dynamic';

// app/api/announcements/route.ts
// DEPRECATED — Redirects to /api/communication/announcements
// Sunset date: 2026-07-01

import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const redirect = new URL(`/api/communication/announcements${url.search}`, request.url);
  return NextResponse.redirect(redirect, 301);
}

export async function POST(request: NextRequest) {
  const url = new URL(request.url);
  const redirect = new URL("/api/communication/announcements", request.url);
  return NextResponse.redirect(redirect, 301);
}
