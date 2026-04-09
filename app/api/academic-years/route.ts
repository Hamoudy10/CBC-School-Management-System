export const dynamic = 'force-dynamic';

// app/api/academic-years/route.ts
// DEPRECATED — Redirects to /api/settings/academic-years
// Sunset date: 2026-07-01

import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const redirect = new URL(`/api/settings/academic-years${url.search}`, request.url);
  return NextResponse.redirect(redirect, 301);
}
