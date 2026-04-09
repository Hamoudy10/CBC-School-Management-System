export const dynamic = 'force-dynamic';

// app/api/terms/route.ts
// DEPRECATED — Redirects to /api/settings/terms
// Sunset date: 2026-07-01

import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const redirect = new URL(`/api/settings/terms${url.search}`, request.url);
  return NextResponse.redirect(redirect, 301);
}
