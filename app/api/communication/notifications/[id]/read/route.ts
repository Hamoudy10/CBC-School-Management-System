// app/api/communication/notifications/[id]/read/route.ts
// DEPRECATED — Redirects to /api/notifications/[id]/read
// Sunset date: 2026-07-01

import { NextRequest, NextResponse } from "next/server";

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  const redirect = new URL(`/api/notifications/${params.id}/read`, request.url);
  return NextResponse.redirect(redirect, 301);
}
