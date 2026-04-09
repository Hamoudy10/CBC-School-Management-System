// app/api/announcements/[id]/route.ts
// DEPRECATED — Redirects to /api/communication/announcements/[id]
// Sunset date: 2026-07-01

import { NextRequest, NextResponse } from "next/server";

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  const url = new URL(request.url);
  const redirect = new URL(
    `/api/communication/announcements/${params.id}${url.search}`,
    request.url,
  );
  return NextResponse.redirect(redirect, 301);
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  const redirect = new URL(
    `/api/communication/announcements/${params.id}`,
    request.url,
  );
  return NextResponse.redirect(redirect, 301);
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  const redirect = new URL(
    `/api/communication/announcements/${params.id}`,
    request.url,
  );
  return NextResponse.redirect(redirect, 301);
}
