// lib/supabase/server.ts
// ============================================================
// Server-side Supabase client for:
// - API routes
// - Server components
// - Middleware
// Uses cookies for session management (HTTP-only, secure)
// ============================================================

import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

// ============================================================
// Server Client (respects RLS — uses user's session)
// ============================================================
export async function createSupabaseServerClient() {
  const cookieStore = await cookies();

  return createServerClient<any>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          try {
            cookieStore.set({ name, value, ...options });
          } catch {
            // Handle cookie setting in read-only contexts (Server Components)
          }
        },
        remove(name: string, options: CookieOptions) {
          try {
            cookieStore.set({ name, value: "", ...options });
          } catch {
            // Handle cookie removal in read-only contexts
          }
        },
      },
    },
  );
}

// ============================================================
// Admin Client (bypasses RLS — server-only, privileged ops)
// NEVER expose to frontend
// ============================================================
export async function createSupabaseAdminClient() {
  return createClient<any>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    },
  );
}

export const createServerSupabaseClient = createSupabaseServerClient;
