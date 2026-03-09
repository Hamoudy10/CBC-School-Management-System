// app/api/auth/logout/route.ts
// ============================================================
// POST /api/auth/logout
// Sign out current user
// ============================================================

export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { successResponse, errorResponse } from "@/lib/api/response";

// ============================================================
// POST Handler
// ============================================================
export async function POST(request: NextRequest) {
  const supabase = await createSupabaseServerClient();

  const { error } = await supabase.auth.signOut();

  if (error) {
    return errorResponse("Logout failed");
  }

  return successResponse({ message: "Logged out successfully" });
}
